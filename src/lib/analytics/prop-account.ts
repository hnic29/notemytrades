import { computeDrawdown, computeEquityCurve, type StatsTrade } from "./stats";
import { localDateKey } from "@/lib/date-key";

export type PropAccountMetrics = {
  currentBalance: number;
  netPnl: number;
  profitProgressPct: number | null; // 0..1+, null if no target set
  todayPnl: number;
  dailyLossBreached: boolean;
  totalDrawdown: number;
  totalDrawdownBreached: boolean;
};

/**
 * Everything a prop-firm challenge dashboard needs to answer "am I on
 * track and within the rules today" — computed from the account's own
 * trades plus firm-charged fees/adjustments, never from a live feed
 * (there is no broker connection here, see PropFirm Sync scope notes).
 */
export function computePropAccountMetrics(input: {
  accountSize: number;
  trades: StatsTrade[];
  transactionTotal: number; // sum of fees/deposits/adjustments, signed
  profitTarget: number | null;
  maxDailyLoss: number | null;
  maxTotalDrawdown: number | null;
  todayKey: string; // yyyy-MM-dd, injected so this stays pure/testable
}): PropAccountMetrics {
  const closed = input.trades.filter((t) => t.closedAt != null);
  const netPnl = closed.reduce((sum, t) => sum + t.netPnl, 0);
  const currentBalance = input.accountSize + netPnl + input.transactionTotal;

  const todayPnl = closed
    .filter((t) => localDateKey(t.closedAt!) === input.todayKey)
    .reduce((sum, t) => sum + t.netPnl, 0);

  const equityCurve = computeEquityCurve(closed, input.accountSize);
  const drawdown = computeDrawdown(equityCurve);

  return {
    currentBalance,
    netPnl,
    profitProgressPct: input.profitTarget ? netPnl / input.profitTarget : null,
    todayPnl,
    dailyLossBreached: input.maxDailyLoss != null && todayPnl < -Math.abs(input.maxDailyLoss),
    totalDrawdown: drawdown.maxDrawdown,
    totalDrawdownBreached:
      input.maxTotalDrawdown != null && drawdown.maxDrawdown > Math.abs(input.maxTotalDrawdown),
  };
}
