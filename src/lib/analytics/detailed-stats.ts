import { computeDailyPnl, computeSummaryStats, type StatsTrade } from "./stats";
import { computeRiskMetrics } from "./grouping";

export type DetailedStatsTrade = StatsTrade & {
  fees: number;
  commissions: number;
};

export type DetailedStats = {
  bestMonth: { label: string; value: number } | null;
  lowestMonth: { label: string; value: number } | null;
  avgMonth: number;

  largestWin: number;
  largestLoss: number; // negative or 0

  avgHoldMinutesAll: number | null;
  avgHoldMinutesWinning: number | null;
  avgHoldMinutesLosing: number | null;

  totalCommissions: number;
  totalFees: number;

  totalTradingDays: number;
  winningDays: number;
  losingDays: number;
  breakevenDays: number;
  maxConsecutiveWinningDays: number;
  maxConsecutiveLosingDays: number;
  avgDailyPnl: number;
  avgWinningDayPnl: number;
  avgLosingDayPnl: number;
  largestProfitableDay: number;
  largestLosingDay: number;

  expectancy: number;
};

/**
 * Everything the dense "Your Stats" table needs beyond SummaryStats —
 * kept as a separate pass over the same trades rather than folded into
 * computeSummaryStats, since most callers (dashboard widgets, strategy
 * cards) only need the cheaper summary and would pay for hold-time /
 * day-streak computation they never use.
 */
export function computeDetailedStats(trades: DetailedStatsTrade[]): DetailedStats {
  const closed = trades.filter((t) => t.closedAt != null);
  const wins = closed.filter((t) => t.netPnl > 0);
  const losses = closed.filter((t) => t.netPnl < 0);

  const largestWin = wins.length > 0 ? Math.max(...wins.map((t) => t.netPnl)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.netPnl)) : 0;

  const holdMinutes = (t: StatsTrade) =>
    t.closedAt ? (t.closedAt.getTime() - t.openedAt.getTime()) / 60000 : null;
  const avg = (nums: number[]) => (nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : null);

  const avgHoldMinutesAll = avg(closed.map(holdMinutes).filter((n): n is number => n != null));
  const avgHoldMinutesWinning = avg(wins.map(holdMinutes).filter((n): n is number => n != null));
  const avgHoldMinutesLosing = avg(losses.map(holdMinutes).filter((n): n is number => n != null));

  const totalCommissions = closed.reduce((s, t) => s + t.commissions, 0);
  const totalFees = closed.reduce((s, t) => s + t.fees, 0);

  const dailyPnl = computeDailyPnl(trades);
  const dayEntries = Array.from(dailyPnl.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const dayValues = dayEntries.map(([, v]) => v);

  const winningDays = dayValues.filter((v) => v > 0).length;
  const losingDays = dayValues.filter((v) => v < 0).length;
  const breakevenDays = dayValues.filter((v) => v === 0).length;

  let maxConsecutiveWinningDays = 0;
  let maxConsecutiveLosingDays = 0;
  let winStreak = 0;
  let lossStreak = 0;
  for (const v of dayValues) {
    if (v > 0) {
      winStreak++;
      lossStreak = 0;
    } else if (v < 0) {
      lossStreak++;
      winStreak = 0;
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
    maxConsecutiveWinningDays = Math.max(maxConsecutiveWinningDays, winStreak);
    maxConsecutiveLosingDays = Math.max(maxConsecutiveLosingDays, lossStreak);
  }

  const stats = computeSummaryStats(trades);
  const winRate = stats.winRate ?? 0;
  const expectancy = winRate * stats.avgWin - (1 - winRate) * stats.avgLoss;

  const monthTotalsMap = new Map<string, number>();
  for (const t of closed) {
    const key = t.closedAt!.toISOString().slice(0, 7);
    monthTotalsMap.set(key, (monthTotalsMap.get(key) ?? 0) + t.netPnl);
  }
  const monthTotals = Array.from(monthTotalsMap.entries()).map(([label, value]) => ({ label, value }));
  const bestMonth =
    monthTotals.length > 0
      ? monthTotals.reduce((best, m) => (m.value > best.value ? m : best))
      : null;
  const lowestMonth =
    monthTotals.length > 0
      ? monthTotals.reduce((worst, m) => (m.value < worst.value ? m : worst))
      : null;
  const avgMonth = monthTotals.length > 0 ? monthTotals.reduce((s, m) => s + m.value, 0) / monthTotals.length : 0;

  return {
    bestMonth,
    lowestMonth,
    avgMonth,
    largestWin,
    largestLoss,
    avgHoldMinutesAll,
    avgHoldMinutesWinning,
    avgHoldMinutesLosing,
    totalCommissions,
    totalFees,
    totalTradingDays: dayEntries.length,
    winningDays,
    losingDays,
    breakevenDays,
    maxConsecutiveWinningDays,
    maxConsecutiveLosingDays,
    avgDailyPnl: avg(dayValues) ?? 0,
    avgWinningDayPnl: avg(dayValues.filter((v) => v > 0)) ?? 0,
    avgLosingDayPnl: avg(dayValues.filter((v) => v < 0)) ?? 0,
    largestProfitableDay: dayValues.length > 0 ? Math.max(...dayValues, 0) : 0,
    largestLosingDay: dayValues.length > 0 ? Math.min(...dayValues, 0) : 0,
    expectancy,
  };
}

export type HoldTimeBucket = { label: string; count: number; netPnl: number };

const HOLD_TIME_BUCKETS: { label: string; maxMinutes: number }[] = [
  { label: "Under 1 min", maxMinutes: 1 },
  { label: "1-2 min", maxMinutes: 2 },
  { label: "2-5 min", maxMinutes: 5 },
  { label: "5-10 min", maxMinutes: 10 },
  { label: "10-30 min", maxMinutes: 30 },
  { label: "30-60 min", maxMinutes: 60 },
  { label: "1-4 hrs", maxMinutes: 240 },
  { label: "4+ hrs", maxMinutes: Infinity },
];

/** Buckets closed trades by hold duration, tracking both trade count
 * and signed net P&L per bucket — a duration that wins often but small
 * and loses rarely but big looks very different on each axis. */
export function computeHoldTimeDistribution(trades: DetailedStatsTrade[]): HoldTimeBucket[] {
  const buckets: HoldTimeBucket[] = HOLD_TIME_BUCKETS.map((b) => ({
    label: b.label,
    count: 0,
    netPnl: 0,
  }));

  for (const t of trades) {
    if (!t.closedAt) continue;
    const minutes = (t.closedAt.getTime() - t.openedAt.getTime()) / 60000;
    const idx = HOLD_TIME_BUCKETS.findIndex((b) => minutes < b.maxMinutes);
    const target = buckets[idx === -1 ? buckets.length - 1 : idx];
    target.count++;
    target.netPnl += t.netPnl;
  }

  return buckets;
}

/** riskMetrics (avg planned reward:risk, avg realized R-multiple) live
 * in grouping.ts already — re-exported here so the Overview page has
 * one import for "everything the dense stats table needs". */
export { computeRiskMetrics };
