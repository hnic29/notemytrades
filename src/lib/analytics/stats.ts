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
    { date: closed[0]?.closedAt?.toISOString().slice(0, 10) ?? dateKey(new Date()), equity: running },
  ];
  for (const t of closed) {
    running += t.netPnl;
    points.push({ date: t.closedAt!.toISOString().slice(0, 10), equity: running });
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

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Sums realized net P&L per calendar day, keyed by the trade's close date. */
export function computeDailyPnl(trades: StatsTrade[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trades) {
    if (!t.closedAt) continue;
    const key = dateKey(t.closedAt);
    map.set(key, (map.get(key) ?? 0) + t.netPnl);
  }
  return map;
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

/**
 * A simple, transparent 0-100 composite score — not a rigorous
 * statistical measure, just a rough at-a-glance blend of win rate,
 * profit factor, and win/loss size ratio, equally weighted. Returns
 * null when there isn't enough closed-trade history to be meaningful.
 */
export function computeTradeScore(stats: SummaryStats): number | null {
  if (stats.closedTrades < 5) return null;

  const winRateScore = (stats.winRate ?? 0) * 100;
  const profitFactorScore =
    stats.profitFactor == null ? (stats.avgWin > 0 ? 100 : 0) : Math.min(stats.profitFactor / 3, 1) * 100;
  const winLossRatioScore =
    stats.avgLoss > 0 ? Math.min(stats.avgWin / stats.avgLoss / 2, 1) * 100 : 100;

  return Math.round((winRateScore + profitFactorScore + winLossRatioScore) / 3);
}
