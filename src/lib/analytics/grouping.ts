import { computeSummaryStats, type StatsTrade, type SummaryStats } from "./stats";

export type ReportTrade = StatsTrade & {
  symbol: string;
  side: "long" | "short";
  assetType: string;
  tagNames: string[];
  strategyName: string | null;
  stopLoss: number | null;
  profitTarget: number | null;
  avgEntryPrice: number;
  quantity: number;
  multiplier: number;
  fees: number;
  commissions: number;
};

export type Group = { key: string; label: string; stats: SummaryStats };

/**
 * Buckets trades by a key-extraction function and computes summary
 * stats per bucket. A trade contributing to multiple buckets (e.g. tags)
 * is supported by keyFn returning an array of keys.
 */
export function groupTradeStats(
  trades: ReportTrade[],
  keyFn: (t: ReportTrade) => string | string[] | null,
): Group[] {
  const buckets = new Map<string, ReportTrade[]>();
  for (const t of trades) {
    const keys = keyFn(t);
    if (keys == null) continue;
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(t);
    }
  }
  return Array.from(buckets.entries())
    .map(([key, rows]) => ({ key, label: key, stats: computeSummaryStats(rows) }))
    .sort((a, b) => b.stats.netPnl - a.stats.netPnl);
}

export const bySymbol = (trades: ReportTrade[]) => groupTradeStats(trades, (t) => t.symbol);

export const byTag = (trades: ReportTrade[]) =>
  groupTradeStats(trades, (t) => (t.tagNames.length > 0 ? t.tagNames : null));

export const byStrategy = (trades: ReportTrade[]) =>
  groupTradeStats(trades, (t) => t.strategyName ?? "Unassigned");

export const bySide = (trades: ReportTrade[]) => groupTradeStats(trades, (t) => t.side);

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function byDayOfWeek(trades: ReportTrade[]): Group[] {
  const groups = groupTradeStats(trades, (t) =>
    t.closedAt ? String(t.closedAt.getDay()) : null,
  );
  return groups
    .map((g) => ({ ...g, label: DAY_LABELS[Number(g.key)] }))
    .sort((a, b) => Number(a.key) - Number(b.key));
}

export function byHourOfDay(trades: ReportTrade[]): Group[] {
  const groups = groupTradeStats(trades, (t) =>
    t.closedAt ? String(t.closedAt.getHours()) : null,
  );
  return groups
    .map((g) => {
      const h = Number(g.key);
      const label = `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
      return { ...g, label };
    })
    .sort((a, b) => Number(a.key) - Number(b.key));
}

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function byWeek(trades: ReportTrade[]): Group[] {
  return groupTradeStats(trades, (t) => (t.closedAt ? isoWeekKey(t.closedAt) : null)).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

export function byMonth(trades: ReportTrade[]): Group[] {
  return groupTradeStats(trades, (t) =>
    t.closedAt ? t.closedAt.toISOString().slice(0, 7) : null,
  ).sort((a, b) => a.key.localeCompare(b.key));
}

export type RiskMetrics = {
  tradesWithRiskDefined: number;
  avgRiskPerTrade: number | null; // avg $ distance from entry to stop, sized by quantity*multiplier
  avgRewardToRisk: number | null; // avg( (target-entry)/(entry-stop) ), unsigned
  avgRMultiple: number | null; // avg( actual netPnl / planned $ risk )
};

/** Risk metrics only cover trades that had a stopLoss set at entry —
 * everything else has no basis for a planned-risk comparison. */
export function computeRiskMetrics(trades: ReportTrade[]): RiskMetrics {
  const withRisk = trades.filter((t) => t.stopLoss != null && t.closedAt != null);
  if (withRisk.length === 0) {
    return {
      tradesWithRiskDefined: 0,
      avgRiskPerTrade: null,
      avgRewardToRisk: null,
      avgRMultiple: null,
    };
  }

  let totalRisk = 0;
  let totalRMultiple = 0;
  let rewardRiskCount = 0;
  let totalRewardRisk = 0;

  for (const t of withRisk) {
    const riskPerUnit = Math.abs(t.avgEntryPrice - t.stopLoss!);
    const plannedRisk = riskPerUnit * t.quantity * t.multiplier;
    totalRisk += plannedRisk;
    if (plannedRisk > 0) {
      totalRMultiple += t.netPnl / plannedRisk;
    }
    if (t.profitTarget != null && riskPerUnit > 0) {
      const rewardPerUnit = Math.abs(t.profitTarget - t.avgEntryPrice);
      totalRewardRisk += rewardPerUnit / riskPerUnit;
      rewardRiskCount++;
    }
  }

  return {
    tradesWithRiskDefined: withRisk.length,
    avgRiskPerTrade: totalRisk / withRisk.length,
    avgRewardToRisk: rewardRiskCount > 0 ? totalRewardRisk / rewardRiskCount : null,
    avgRMultiple: totalRMultiple / withRisk.length,
  };
}
