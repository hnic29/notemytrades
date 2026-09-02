import { computeDailyPnl, computeDrawdown, computeEquityCurve, type StatsTrade } from "./stats";

export type RiskRatios = {
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
};

const TRADING_DAYS_PER_YEAR = 252;
/** Below this many distinct trading days, a daily-return series is too
 * thin to say anything about variance — same "not enough history"
 * threshold philosophy as computeTradeScore's 5-closed-trade minimum. */
const MIN_TRADING_DAYS = 5;

function stdev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Sharpe/Sortino/Calmar computed on the session's *daily* realized P&L
 * series (as a fraction of starting balance), risk-free rate assumed 0
 * — the standard retail-tool simplification, and the same granularity
 * "Sharpe ratio" conventionally means, so these are comparable across
 * backtest sessions the way a textbook annualized Sharpe would be.
 * Short sessions or Yahoo's free-data intraday limits can shrink the
 * sample size, which the null-when-too-little-history behavior below
 * surfaces rather than reporting a number built on a handful of days.
 */
export function computeRiskRatios(
  trades: StatsTrade[],
  startingBalance: number,
  sessionStartDate: Date,
  sessionEndDate: Date,
): RiskRatios {
  if (startingBalance <= 0) return { sharpe: null, sortino: null, calmar: null };

  const dailyPnl = computeDailyPnl(trades);
  if (dailyPnl.size < MIN_TRADING_DAYS) return { sharpe: null, sortino: null, calmar: null };

  const dailyReturns = Array.from(dailyPnl.values()).map((pnl) => pnl / startingBalance);
  const meanReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  const dailyStdev = stdev(dailyReturns, meanReturn);
  const sharpe =
    dailyStdev > 0 ? (meanReturn / dailyStdev) * Math.sqrt(TRADING_DAYS_PER_YEAR) : null;

  const downsideVariance =
    dailyReturns.reduce((sum, r) => sum + Math.min(r, 0) ** 2, 0) / dailyReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);
  const sortino =
    downsideDeviation > 0 ? (meanReturn / downsideDeviation) * Math.sqrt(TRADING_DAYS_PER_YEAR) : null;

  const equityCurve = computeEquityCurve(trades, startingBalance);
  const { maxDrawdownPct } = computeDrawdown(equityCurve);
  const sessionDays = Math.max(1, (sessionEndDate.getTime() - sessionStartDate.getTime()) / 86400000);
  const endingEquity = equityCurve[equityCurve.length - 1]?.equity ?? startingBalance;
  const totalReturnPct = endingEquity / startingBalance - 1;
  const annualizedReturnPct = totalReturnPct * (365 / sessionDays);
  const calmar = maxDrawdownPct > 0 ? annualizedReturnPct / maxDrawdownPct : null;

  return { sharpe, sortino, calmar };
}
