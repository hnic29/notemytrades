"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries/settings";
import { bulkImportTrades } from "@/lib/actions/trades";
import { DEFAULT_CDP_PORT, fetchTradingViewSnapshot, launchHint, TradingViewSyncError } from "@/lib/tradingview/cdp";
import { launchTradingView } from "@/lib/tradingview/launch";
import { snapshotToTrades } from "@/lib/tradingview/sync";

const SINGLETON_ID = "singleton";

export type TradingViewFailure = { ok: false; error: string; hint: string; code: string };

export type TradingViewStatus =
  | {
      ok: true;
      broker: string;
      account: string;
      fills: number;
      openPositions: number;
      verified: boolean;
    }
  | TradingViewFailure;

export type TradingViewSyncResult =
  | {
      ok: true;
      account: string;
      imported: number;
      duplicates: number;
      /** Closed trades the snapshot paired up, before dedup. */
      trades: number;
      fills: number;
      openSymbols: string[];
      warnings: string[];
      errors: { row: number; message: string }[];
      netPnl: number;
    }
  | TradingViewFailure;

function failure(err: unknown): TradingViewFailure {
  if (err instanceof TradingViewSyncError) {
    return { ok: false, error: err.message, hint: err.hint, code: err.code };
  }
  return {
    ok: false,
    error: err instanceof Error ? err.message : "Something went wrong",
    hint: launchHint(),
    code: "unknown",
  };
}

export async function getTradingViewPort(): Promise<number> {
  const settings = await getSettings();
  return settings.tradingViewPort ?? DEFAULT_CDP_PORT;
}

export async function updateTradingViewPort(port: number) {
  const value = Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
  await getSettings(); // ensure the row exists
  await prisma.appSettings.update({
    where: { id: SINGLETON_ID },
    data: { tradingViewPort: value === DEFAULT_CDP_PORT ? null : value },
  });
  revalidatePath("/settings");
}

/** Reads TradingView without importing anything — for Settings and the sync dialog. */
export async function checkTradingView(): Promise<TradingViewStatus> {
  try {
    const snapshot = await fetchTradingViewSnapshot(await getTradingViewPort());
    return {
      ok: true,
      broker: snapshot.broker.title,
      account: snapshot.account?.name || snapshot.account?.id || "",
      fills: snapshot.executions.length,
      openPositions: snapshot.positions.length,
      verified: snapshot.history != null,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function launchTradingViewDesktop(): Promise<{ ok: true; alreadyRunning: boolean } | TradingViewFailure> {
  try {
    const result = await launchTradingView(await getTradingViewPort());
    return { ok: true, ...result };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Pulls every fill Paper Trading remembers, pairs them the way the CSV
 * importer does, and adds whatever isn't in the journal yet. Safe to
 * click as often as you like — duplicates are skipped by the same rule
 * the file importer uses, so a CSV import followed by a sync (or the
 * other way round) doesn't double up either.
 */
export async function syncFromTradingView(accountId: string): Promise<TradingViewSyncResult> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { ok: false, error: "That account no longer exists.", hint: "Pick another account.", code: "account" };

  let preview;
  let accountLabel = "";
  try {
    const snapshot = await fetchTradingViewSnapshot(await getTradingViewPort());
    accountLabel = snapshot.account?.name || snapshot.account?.id || snapshot.broker.title;
    preview = snapshotToTrades(snapshot);
  } catch (err) {
    return failure(err);
  }

  // One import per asset type: a Paper account can hold futures next
  // to stocks, and each trade carries its own type.
  const fallbackType = account.assetType && account.assetType !== "mixed" ? account.assetType : "stock";
  const groups = new Map<string, typeof preview.trades>();
  for (const t of preview.trades) {
    const type = preview.assetTypeBySymbol[t.symbol] ?? preview.suggestedAssetType ?? fallbackType;
    groups.set(type, [...(groups.get(type) ?? []), t]);
  }
  let imported = 0;
  let duplicates = 0;
  for (const [type, rows] of groups) {
    const result = await bulkImportTrades(accountId, type, "tradingview:paper", rows);
    imported += result.imported;
    duplicates += result.duplicates;
  }

  return {
    ok: true,
    account: accountLabel,
    imported,
    duplicates,
    trades: preview.trades.length,
    fills: preview.fillCount,
    openSymbols: preview.openSymbols,
    warnings: preview.warnings ?? [],
    errors: preview.errors,
    netPnl: preview.trades.reduce((s, t) => s + t.netPnl, 0),
  };
}
