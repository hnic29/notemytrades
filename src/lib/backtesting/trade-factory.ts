import { getFuturesPointValue } from "@/lib/import/futures";
import type { TradeSide } from "@/lib/trade-math";

/**
 * A backtest session trades a single symbol for its whole lifetime, so
 * this is really "the session's point value" rather than a per-order
 * choice — stock/crypto/forex stay 1 (share/unit-based), futures use
 * the contract's $-per-point from the same table CSV import uses.
 * An unrecognized futures root falls back to 1, same as CSV import —
 * callers should warn when that happens rather than trust it silently.
 */
export function resolveMultiplier(symbol: string, assetType: string): number {
  if (assetType !== "futures") return 1;
  return getFuturesPointValue(symbol) ?? 1;
}

export type BuildBacktestTradeInput = {
  accountId: string;
  sessionId: string;
  symbol: string;
  assetType: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  entryTime: Date;
  stopLoss: number | null;
  profitTarget: number | null;
  autoBreakevenR: number | null;
};

/**
 * The exact Trade+Execution shape every backtest fill produces — manual
 * market orders, pending-order fills, and the AI rule engine all build
 * their trades through this, so a row's origin is invisible to every
 * downstream stats/report query (they all just see a Trade).
 */
export function buildBacktestTradeCreateData(input: BuildBacktestTradeInput) {
  return {
    accountId: input.accountId,
    backtestSessionId: input.sessionId,
    isBacktest: true,
    symbol: input.symbol.toUpperCase(),
    assetType: input.assetType,
    side: input.side,
    status: "open" as const,
    openedAt: input.entryTime,
    closedAt: null,
    quantity: input.quantity,
    multiplier: resolveMultiplier(input.symbol, input.assetType),
    avgEntryPrice: input.entryPrice,
    avgExitPrice: null,
    grossPnl: 0,
    netPnl: 0,
    stopLoss: input.stopLoss,
    profitTarget: input.profitTarget,
    autoBreakevenR: input.autoBreakevenR,
    source: "backtest",
    executions: {
      create: [
        {
          side: input.side === "long" ? ("buy" as const) : ("sell" as const),
          quantity: input.quantity,
          price: input.entryPrice,
          timestamp: input.entryTime,
          isEntry: true,
        },
      ],
    },
  };
}
