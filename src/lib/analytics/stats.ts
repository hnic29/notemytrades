import { localDateKey } from "@/lib/date-key";

export type StatsTrade = {
  netPnl: number;
  openedAt: Date;
  closedAt: Date | null;
};

export type SummaryStats = {
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  netPnl: number;
  winRate: number | null; // wins / (wins + losses)
  profitFactor: number | null; // sum(wins) / abs(sum(losses)); null if no losses and no wins
  avgWin: number;
  avgLoss: number; // stored as a positive number
  currentStreak: number; // positive = win streak, negative = loss streak
};

/** Trades with no closedAt are treated as still-open and excluded from
 * win/loss/P&L stats (their realized P&L is 0 until closed). */
export function computeSummaryStats(trades: StatsTrade[]): SummaryStats {
  const closed = trades
    .filter((t) => t.closedAt != null)
    .sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime());

  const wins = closed.filter((t) => t.netPnl > 0);
  const losses = closed.filter((t) => t.netPnl < 0);
  const breakeven = closed.length - wins.length - losses.length;

  const netPnl = closed.reduce((sum, t) => sum + t.netPnl, 0);
  const grossWin = wins.reduce((sum, t) => sum + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnl, 0));

  const winRate = wins.length + losses.length > 0 ? wins.length / (wins.length + losses.length) : null;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? null : null;

  let currentStreak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    const t = closed[i];
    if (t.netPnl > 0) {
      if (currentStreak < 0) break;
      currentStreak++;
    } else if (t.netPnl < 0) {
      if (currentStreak > 0) break;
      currentStreak--;
    } else break;
  }

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    netPnl,
    winRate,
    profitFactor,
    avgWin: wins.length > 0 ? grossWin / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    currentStreak,
  };
}

export type EquityPoint = { date: string; equity: number };

export function computeEquityCurve(
  trades: StatsTrade[],
  startingBalance = 0,
): EquityPoint[] {
  const closed = trades
    .filter((t) => t.closedAt != null)
    .sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime());

  let running = startingBalance;
  const points: EquityPoint[] = [
    { date: closed[0]?.closedAt ? localDateKey(closed[0].closedAt) : localDateKey(new Date()), equity: running },
  ];
  for (const t of closed) {
    running += t.netPnl;
    points.push({ date: localDateKey(t.closedAt!), equity: running });
  }
  return points;
}

export type DrawdownResult = {
  maxDrawdown: number; // as a positive dollar amount
  maxDrawdownPct: number; // 0..1
  series: { date: string; drawdown: number }[];
};

export function computeDrawdown(equityCurve: EquityPoint[]): DrawdownResult {
  let peak = equityCurve[0]?.equity ?? 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  const series = equityCurve.map((p) => {
    peak = Math.max(peak, p.equity);
    const drawdown = peak - p.equity;
    const drawdownPct = peak !== 0 ? drawdown / Math.abs(peak) : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct);
    return { date: p.date, drawdown: -drawdown };
  });
  return { maxDrawdown, maxDrawdownPct, series };
}

/** Sums realized net P&L per calendar day, keyed by the trade's close date. */
export function computeDailyPnl(trades: StatsTrade[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trades) {
    if (!t.closedAt) continue;
    const key = localDateKey(t.closedAt);
    map.set(key, (map.get(key) ?? 0) + t.netPnl);
  }
  return map;
}

/**
 * Consecutive winning/losing *days* ending at the most recent trading
 * day — distinct from SummaryStats.currentStreak, which counts
 * consecutive individual trades. A trader can lose the last trade of
 * an otherwise green day; these tell different stories.
 */
export function computeDayStreak(dailyPnl: Map<string, number>): number {
  const days = Array.from(dailyPnl.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  let streak = 0;
  for (const [, value] of days) {
    if (value > 0) {
      if (streak < 0) break;
      streak++;
    } else if (value < 0) {
      if (streak > 0) break;
      streak--;
    } else break;
  }
  return streak;
}

export type PnlBucket = { label: string; count: number; midpoint: number };

/**
 * Buckets closed trades' net P&L into a histogram for a win/loss
 * distribution chart. Bucket width is chosen from the data's own range
 * (capped to a sane number of buckets) rather than a fixed dollar size,
 * so it stays readable for both a $50 scalper and a $50k swing account.
 */
export function computePnlDistribution(trades: StatsTrade[], bucketCount = 10): PnlBucket[] {
  const values = trades.filter((t) => t.closedAt != null).map((t) => t.netPnl);
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: formatBucketLabel(min, max), count: values.length, midpoint: min }];
  }

  const width = (max - min) / bucketCount;
  const buckets: PnlBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const lo = min + i * width;
    const hi = i === bucketCount - 1 ? max : lo + width;
    return { label: formatBucketLabel(lo, hi), count: 0, midpoint: (lo + hi) / 2 };
  });

  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  }
  return buckets;
}

function formatBucketLabel(lo: number, hi: number): string {
  const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : Math.round(n));
  return `${fmt(lo)} to ${fmt(hi)}`;
}

export type TradeScoreFactorKey =
  | "profitFactor"
  | "winRate"
  | "avgWinLoss"
  | "maxDrawdown"
  | "recoveryFactor"
  | "consistency";

export type TradeScoreFactor = {
  key: TradeScoreFactorKey;
  label: string;
  score: number; // 0..100
  weight: number; // 0..1, sums to 1 across all factors
};

export type TradeScore = {
  overall: number; // 0..100, the weighted blend of `factors`
  factors: TradeScoreFactor[];
};

/** Each factor's raw stat, scaled 0-100 against its own "good" ceiling —
 * not percentile ranks, just fixed reference points so the score reads
 * the same regardless of trade count. Weights below are this app's own
 * judgment call on what matters most, not a industry-standard split. */
const TRADE_SCORE_WEIGHTS: Record<TradeScoreFactorKey, number> = {
  profitFactor: 0.25,
  winRate: 0.15,
  avgWinLoss: 0.15,
  maxDrawdown: 0.2,
  recoveryFactor: 0.15,
  consistency: 0.1,
};

/**
 * A simple, transparent 0-100 composite score blending six angles on
 * trading performance — not a rigorous statistical measure, just an
 * at-a-glance read on profitability (profit factor, win rate, avg
 * win/loss size), risk control (max drawdown), resilience after a
 * losing stretch (recovery factor: net P&L relative to the worst
 * drawdown), and how steady day-to-day results have been (consistency:
 * inverse coefficient of variation on daily P&L). Returns null when
 * there isn't enough closed-trade history to be meaningful.
 *
 * `dailyPnlValues` should be every day's realized P&L (win or loss,
 * zero is fine) — used only for the consistency factor.
 */
export function computeTradeScore(
  stats: SummaryStats,
  drawdown: { maxDrawdown: number; maxDrawdownPct: number },
  dailyPnlValues: number[],
): TradeScore | null {
  if (stats.closedTrades < 5) return null;

  const profitFactorScore =
    stats.profitFactor == null ? (stats.avgWin > 0 ? 100 : 0) : Math.min(stats.profitFactor / 2, 1) * 100;
  const winRateScore = Math.min((stats.winRate ?? 0) / 0.55, 1) * 100;
  const avgWinLossScore = stats.avgLoss > 0 ? Math.min(stats.avgWin / stats.avgLoss / 2, 1) * 100 : 100;
  const maxDrawdownScore = 100 - Math.min(drawdown.maxDrawdownPct / 0.3, 1) * 100;
  const recoveryFactorScore =
    stats.netPnl <= 0
      ? 0
      : drawdown.maxDrawdown <= 0
        ? 100
        : Math.min(stats.netPnl / drawdown.maxDrawdown / 2.5, 1) * 100;
  const consistencyScore = (() => {
    if (dailyPnlValues.length < 2) return 50; // not enough days to say anything either way
    const mean = dailyPnlValues.reduce((s, v) => s + v, 0) / dailyPnlValues.length;
    const meanAbs = dailyPnlValues.reduce((s, v) => s + Math.abs(v), 0) / dailyPnlValues.length;
    if (meanAbs === 0) return 50;
    const variance = dailyPnlValues.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnlValues.length;
    const coefficientOfVariation = Math.sqrt(variance) / meanAbs;
    return 100 - Math.min(coefficientOfVariation / 2, 1) * 100;
  })();

  const factors: TradeScoreFactor[] = [
    { key: "profitFactor", label: "Profit Factor", score: Math.round(profitFactorScore), weight: TRADE_SCORE_WEIGHTS.profitFactor },
    { key: "winRate", label: "Win Rate", score: Math.round(winRateScore), weight: TRADE_SCORE_WEIGHTS.winRate },
    { key: "avgWinLoss", label: "Avg Win/Loss", score: Math.round(avgWinLossScore), weight: TRADE_SCORE_WEIGHTS.avgWinLoss },
    { key: "maxDrawdown", label: "Max Drawdown", score: Math.round(maxDrawdownScore), weight: TRADE_SCORE_WEIGHTS.maxDrawdown },
    { key: "recoveryFactor", label: "Recovery Factor", score: Math.round(recoveryFactorScore), weight: TRADE_SCORE_WEIGHTS.recoveryFactor },
    { key: "consistency", label: "Consistency", score: Math.round(consistencyScore), weight: TRADE_SCORE_WEIGHTS.consistency },
  ];

  const overall = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
  return { overall, factors };
}
