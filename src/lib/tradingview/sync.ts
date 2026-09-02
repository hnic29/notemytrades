import type { ParseResult } from "@/lib/import/common";
import { parseTradingViewSymbol } from "@/lib/import/futures";
import type { PairingExec } from "@/lib/import/pairing";
import { pairTradingViewPaper, parseCloseAction, type BalanceClose } from "@/lib/import/tradingview";
import type { TradingViewSnapshot } from "./snapshot";

export type SyncPreview = ParseResult & {
  /** Fills the snapshot held, after dropping malformed ones. */
  fillCount: number;
  /** Symbols with something still open in TradingView. */
  openSymbols: string[];
  /** Asset type per normalized symbol, where the symbol itself says (CME → futures). */
  assetTypeBySymbol: Record<string, string | null>;
};

/**
 * Turns a live snapshot into the same shape the CSV importer produces,
 * through the same pairing and verification. The three exports map
 * one-to-one: executions ≙ order history (fills only), positions ≙
 * positions, account history ≙ balance history — down to the "Close …
 * position" text, which is parsed by the same function.
 */
export function snapshotToTrades(snapshot: TradingViewSnapshot): SyncPreview {
  const execs: PairingExec[] = [];
  const assetTypes = new Map<string, string | null>();
  const errors: ParseResult["errors"] = [];

  snapshot.executions.forEach((t, index) => {
    const parsed = parseTradingViewSymbol(t.symbol);
    if (t.qty <= 0 || !Number.isFinite(t.price)) {
      errors.push({ row: index + 1, message: `Unreadable fill ${t.id} for ${t.symbol}` });
      return;
    }
    assetTypes.set(parsed.symbol, parsed.assetType);
    execs.push({
      rowNum: index + 1,
      symbol: parsed.symbol,
      side: t.side === -1 ? "sell" : "buy",
      qty: Math.abs(t.qty),
      price: t.price,
      time: new Date(t.time).toISOString(),
      // Execution ids grow with time, so they order same-timestamp fills.
      seq: Number(t.id) || index,
      commissions: Math.abs(t.commission ?? 0),
    });
  });

  // Net position per symbol right now — the window ends at the snapshot.
  const endPositions = new Map<string, number>();
  for (const p of snapshot.positions) {
    const symbol = parseTradingViewSymbol(p.symbol).symbol;
    endPositions.set(symbol, (endPositions.get(symbol) ?? 0) + (p.side === -1 ? -p.qty : p.qty));
  }

  let closes: BalanceClose[] | null = null;
  if (snapshot.history) {
    closes = [];
    for (const h of snapshot.history) {
      const close = parseCloseAction(h.comment);
      if (!close) continue; // deposits, resets
      closes.push({
        ...close,
        realizedPnl: Math.round((h.after - h.before) * 100) / 100,
        time: new Date(h.time * 1000).toISOString(),
      });
    }
    closes.sort((a, b) => a.time.localeCompare(b.time));
  }

  const pointValues = new Map<string, number>();
  for (const [raw, pv] of Object.entries(snapshot.pointValues)) {
    pointValues.set(parseTradingViewSymbol(raw).symbol, pv);
  }

  const warnings: string[] = [];
  if (!snapshot.history) {
    warnings.push(
      "TradingView didn't hand over its balance history, so P&L couldn't be double-checked against its own numbers this time.",
    );
  }

  const result = pairTradingViewPaper({
    execs,
    assetTypes,
    endPositions,
    closes,
    pointValues,
    errors,
    warnings,
    windowLabel: "TradingView's execution history",
    windowEndLabel: "the moment of the sync",
  });

  return {
    ...result,
    fillCount: execs.length,
    openSymbols: [...endPositions.entries()].filter(([, q]) => q !== 0).map(([s]) => s),
    assetTypeBySymbol: Object.fromEntries(assetTypes),
  };
}
