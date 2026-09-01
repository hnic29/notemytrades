"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeTradeMath, type TradeSide } from "@/lib/trade-math";

export type ManualTradeInput = {
  accountId: string;
  symbol: string;
  assetType: string;
  side: TradeSide;
  quantity: number;
  multiplier: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  openedAt: string; // ISO datetime-local value
  closedAt: string | null;
  fees: number;
  commissions: number;
  stopLoss: number | null;
  profitTarget: number | null;
  quickNote: string | null;
  tagNames: string[];
};

function buildTradeData(input: ManualTradeInput) {
  const math = computeTradeMath({
    side: input.side,
    quantity: input.quantity,
    multiplier: input.multiplier,
    avgEntryPrice: input.avgEntryPrice,
    avgExitPrice: input.avgExitPrice,
    fees: input.fees,
    commissions: input.commissions,
  });

  return {
    accountId: input.accountId,
    symbol: input.symbol.toUpperCase().trim(),
    assetType: input.assetType,
    side: input.side,
    status: input.avgExitPrice == null ? "open" : "closed",
    openedAt: new Date(input.openedAt),
    closedAt: input.closedAt ? new Date(input.closedAt) : null,
    quantity: input.quantity,
    multiplier: input.multiplier,
    avgEntryPrice: input.avgEntryPrice,
    avgExitPrice: input.avgExitPrice,
    grossPnl: math.grossPnl,
    fees: input.fees,
    commissions: input.commissions,
    netPnl: math.netPnl,
    netRoi: math.netRoi,
    stopLoss: input.stopLoss,
    profitTarget: input.profitTarget,
    quickNote: input.quickNote,
    source: "manual",
  };
}

async function attachTags(tradeId: string, tagNames: string[]) {
  for (const raw of tagNames) {
    const name = raw.trim();
    if (!name) continue;
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.tradeTag.upsert({
      where: { tradeId_tagId: { tradeId, tagId: tag.id } },
      update: {},
      create: { tradeId, tagId: tag.id },
    });
  }
}

export async function createManualTrade(input: ManualTradeInput) {
  const data = buildTradeData(input);
  const trade = await prisma.trade.create({
    data: {
      ...data,
      executions: {
        create: [
          {
            side: input.side === "long" ? "buy" : "sell",
            quantity: input.quantity,
            price: input.avgEntryPrice,
            timestamp: new Date(input.openedAt),
            isEntry: true,
          },
          ...(input.avgExitPrice != null
            ? [
                {
                  side: input.side === "long" ? "sell" : "buy",
                  quantity: input.quantity,
                  price: input.avgExitPrice,
                  timestamp: new Date(input.closedAt ?? input.openedAt),
                  isEntry: false,
                },
              ]
            : []),
        ],
      },
    },
  });

  await attachTags(trade.id, input.tagNames);
  revalidatePath("/trades");
  revalidatePath("/dashboard");
  return trade;
}

export async function updateTrade(id: string, input: ManualTradeInput) {
  const data = buildTradeData(input);
  const trade = await prisma.trade.update({ where: { id }, data });

  await prisma.tradeTag.deleteMany({ where: { tradeId: id } });
  await attachTags(id, input.tagNames);

  revalidatePath("/trades");
  revalidatePath(`/trades/${id}`);
  revalidatePath("/dashboard");
  return trade;
}

export async function deleteTrade(id: string) {
  await prisma.trade.delete({ where: { id } });
  revalidatePath("/trades");
  revalidatePath("/dashboard");
}

export async function deleteTrades(ids: string[]) {
  await prisma.trade.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/trades");
  revalidatePath("/dashboard");
}

export type BulkImportRow = {
  symbol: string;
  side: TradeSide;
  quantity: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  openedAt: string;
  closedAt: string | null;
  fees: number;
  commissions: number;
  netPnl: number;
  netRoi: number | null;
};

export async function bulkImportTrades(
  accountId: string,
  assetType: string,
  sourceLabel: string,
  rows: BulkImportRow[],
) {
  const result = await prisma.trade.createMany({
    data: rows.map((r) => ({
      accountId,
      symbol: r.symbol,
      assetType,
      side: r.side,
      status: r.avgExitPrice == null ? "open" : "closed",
      openedAt: new Date(r.openedAt),
      closedAt: r.closedAt ? new Date(r.closedAt) : null,
      quantity: r.quantity,
      avgEntryPrice: r.avgEntryPrice,
      avgExitPrice: r.avgExitPrice,
      grossPnl: r.netPnl + r.fees + r.commissions,
      fees: r.fees,
      commissions: r.commissions,
      netPnl: r.netPnl,
      netRoi: r.netRoi,
      source: `csv:${sourceLabel}`,
    })),
  });
  revalidatePath("/trades");
  revalidatePath("/dashboard");
  return result.count;
}

export async function generateShareLink(id: string) {
  const trade = await prisma.trade.findUniqueOrThrow({ where: { id } });
  if (trade.shareSlug) return trade.shareSlug;
  const slug = randomBytes(6).toString("hex");
  await prisma.trade.update({ where: { id }, data: { shareSlug: slug } });
  revalidatePath(`/trades/${id}`);
  return slug;
}

export async function revokeShareLink(id: string) {
  await prisma.trade.update({ where: { id }, data: { shareSlug: null } });
  revalidatePath(`/trades/${id}`);
}

export async function transferTrade(id: string, newAccountId: string) {
  await prisma.trade.update({
    where: { id },
    data: { accountId: newAccountId },
  });
  revalidatePath("/trades");
}

/**
 * Splits a trade's quantity into two trades. The original keeps
 * `keepQuantity`; a new sibling trade is created for the remainder,
 * both carrying the same avg prices (this is a quantity split, not a
 * re-fill — use for correcting a batched import, not partial exits,
 * which are better modeled as extra Executions instead).
 */
export async function splitTrade(id: string, keepQuantity: number) {
  const trade = await prisma.trade.findUniqueOrThrow({ where: { id } });
  if (keepQuantity <= 0 || keepQuantity >= trade.quantity) {
    throw new Error("Split quantity must be between 0 and the trade quantity");
  }
  const remainderQuantity = trade.quantity - keepQuantity;

  const mathFor = (qty: number) =>
    computeTradeMath({
      side: trade.side as TradeSide,
      quantity: qty,
      multiplier: trade.multiplier,
      avgEntryPrice: trade.avgEntryPrice,
      avgExitPrice: trade.avgExitPrice,
      fees: trade.fees / 2,
      commissions: trade.commissions / 2,
    });

  const keepMath = mathFor(keepQuantity);
  const remainderMath = mathFor(remainderQuantity);

  await prisma.$transaction([
    prisma.trade.update({
      where: { id },
      data: {
        quantity: keepQuantity,
        fees: trade.fees / 2,
        commissions: trade.commissions / 2,
        grossPnl: keepMath.grossPnl,
        netPnl: keepMath.netPnl,
        netRoi: keepMath.netRoi,
      },
    }),
    prisma.trade.create({
      data: {
        accountId: trade.accountId,
        symbol: trade.symbol,
        assetType: trade.assetType,
        side: trade.side,
        status: trade.status,
        openedAt: trade.openedAt,
        closedAt: trade.closedAt,
        quantity: remainderQuantity,
        multiplier: trade.multiplier,
        avgEntryPrice: trade.avgEntryPrice,
        avgExitPrice: trade.avgExitPrice,
        grossPnl: remainderMath.grossPnl,
        fees: trade.fees / 2,
        commissions: trade.commissions / 2,
        netPnl: remainderMath.netPnl,
        netRoi: remainderMath.netRoi,
        stopLoss: trade.stopLoss,
        profitTarget: trade.profitTarget,
        quickNote: trade.quickNote,
        source: trade.source,
      },
    }),
  ]);

  revalidatePath("/trades");
}

/**
 * Merges two or more trades (same account+symbol+side) into the first
 * one, weighted-averaging entry/exit prices from their executions and
 * summing quantities/fees/commissions.
 */
export async function mergeTrades(ids: string[]) {
  if (ids.length < 2) throw new Error("Select at least two trades to merge");

  const trades = await prisma.trade.findMany({
    where: { id: { in: ids } },
    include: { executions: true },
  });
  if (trades.length !== ids.length) throw new Error("Some trades were not found");

  const [primary, ...rest] = trades;
  const sameGroup = trades.every(
    (t) =>
      t.accountId === primary.accountId &&
      t.symbol === primary.symbol &&
      t.side === primary.side,
  );
  if (!sameGroup) {
    throw new Error("Trades must share the same account, symbol, and side to merge");
  }

  const allExecutions = trades.flatMap((t) => t.executions);
  const totalQuantity = trades.reduce((sum, t) => sum + t.quantity, 0);
  const weightedEntry =
    trades.reduce((sum, t) => sum + t.avgEntryPrice * t.quantity, 0) / totalQuantity;

  const exitedTrades = trades.filter((t) => t.avgExitPrice != null);
  const exitedQty = exitedTrades.reduce((sum, t) => sum + t.quantity, 0);
  const weightedExit =
    exitedTrades.length > 0
      ? exitedTrades.reduce((sum, t) => sum + (t.avgExitPrice ?? 0) * t.quantity, 0) / exitedQty
      : null;

  const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);
  const totalCommissions = trades.reduce((sum, t) => sum + t.commissions, 0);

  const math = computeTradeMath({
    side: primary.side as TradeSide,
    quantity: totalQuantity,
    multiplier: primary.multiplier,
    avgEntryPrice: weightedEntry,
    avgExitPrice: weightedExit,
    fees: totalFees,
    commissions: totalCommissions,
  });

  await prisma.$transaction([
    prisma.execution.updateMany({
      where: { id: { in: allExecutions.map((e) => e.id) } },
      data: { tradeId: primary.id },
    }),
    prisma.trade.update({
      where: { id: primary.id },
      data: {
        quantity: totalQuantity,
        avgEntryPrice: weightedEntry,
        avgExitPrice: weightedExit,
        status: weightedExit == null ? "open" : "closed",
        grossPnl: math.grossPnl,
        netPnl: math.netPnl,
        netRoi: math.netRoi,
        fees: totalFees,
        commissions: totalCommissions,
        openedAt: new Date(
          Math.min(...trades.map((t) => t.openedAt.getTime())),
        ),
        closedAt: trades.some((t) => t.closedAt)
          ? new Date(Math.max(...trades.filter((t) => t.closedAt).map((t) => t.closedAt!.getTime())))
          : null,
      },
    }),
    prisma.trade.deleteMany({ where: { id: { in: rest.map((t) => t.id) } } }),
  ]);

  revalidatePath("/trades");
}
