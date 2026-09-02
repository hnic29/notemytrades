import type { TradeSide } from "@/lib/trade-math";

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
