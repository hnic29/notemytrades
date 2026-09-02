import { localDateKey } from "@/lib/date-key";

export type FeeProfileLike = {
  perContractFeeFutures: number | null;
  perContractFeeOptions: number | null;
  perShareFeeStock: number | null;
};

export type FeeTrade = {
  assetType: string;
  quantity: number;
  avgExitPrice: number | null;
  closedAt: Date | null;
  grossPnl: number;
  fees: number;
  commissions: number;
};

export type FeeSummary = {
  grossPnl: number;
  /** Real recorded fees/commissions plus whatever got estimated below — the number actually subtracted from grossPnl. */
  totalFees: number;
  /** netPnl = grossPnl - totalFees — this is the "take-home" figure the whole feature exists to surface. */
  netPnl: number;
  /** The portion of totalFees that came from the selected broker profile's estimate, not real recorded data. */
  estimatedFeesTotal: number;
  /** Purely the user's own number (taxSetAsidePct) applied to netPnl — 0 if unset or netPnl <= 0. Never asserted by this app. */
  taxSetAside: number;
  afterTax: number;
  tradeCount: number;
  /** Closed trades whose assetType has no rate in the selected profile — real gross/fees still count them, but no estimate was possible. */
  uncoveredTradeCount: number;
};

function feeForAssetType(profile: FeeProfileLike, assetType: string): number | null {
  switch (assetType) {
    case "futures":
      return profile.perContractFeeFutures;
    case "option":
      return profile.perContractFeeOptions;
    case "stock":
      return profile.perShareFeeStock;
    default:
      // forex/crypto typically cost via spread, not a per-transaction
      // fee — not modeled here rather than guessing a number.
      return null;
  }
}

/**
 * Real recorded fees (Trade.fees + Trade.commissions) always win when
 * present — a broker profile only fills in the gap for trades that
 * show $0, which is exactly what TradingView Paper Trading fills look
 * like (simulated, nothing was actually charged). This is deliberate:
 * never override real data with a hypothetical, only estimate where
 * there's genuinely nothing to go on.
 */
export function computeFeeSummary(
  trades: FeeTrade[],
  profile: FeeProfileLike | null,
  taxSetAsidePct: number | null,
): FeeSummary {
  let grossPnl = 0;
  let totalFees = 0;
  let estimatedFeesTotal = 0;
  let tradeCount = 0;
  let uncoveredTradeCount = 0;

  for (const t of trades) {
    if (!t.closedAt) continue; // only realized trades count toward take-home
    tradeCount++;
    grossPnl += t.grossPnl;

    const recorded = t.fees + t.commissions;
    if (recorded > 0) {
      totalFees += recorded;
      continue;
    }
    if (!profile) continue; // nothing recorded, no broker selected to estimate from

    const perUnit = feeForAssetType(profile, t.assetType);
    if (perUnit == null) {
      uncoveredTradeCount++;
      continue;
    }
    const sides = t.avgExitPrice != null ? 2 : 1; // closed = entry + exit; still-open = entry only
    const estimated = perUnit * t.quantity * sides;
    totalFees += estimated;
    estimatedFeesTotal += estimated;
  }

  const netPnl = grossPnl - totalFees;
  const taxSetAside = taxSetAsidePct && netPnl > 0 ? netPnl * (taxSetAsidePct / 100) : 0;
  const afterTax = netPnl - taxSetAside;

  return { grossPnl, totalFees, netPnl, estimatedFeesTotal, taxSetAside, afterTax, tradeCount, uncoveredTradeCount };
}

export type Period = "day" | "week" | "month" | "year";

export type PeriodFeeSummary = { key: string; summary: FeeSummary };

/** Local-time ISO week key (yyyy-Www) — same algorithm as the Reports
 * rollup tables' week grouping, but local-day-based (see src/lib/date-key.ts)
 * rather than UTC, so it agrees with the rest of the app after that fix. */
function localIsoWeekKey(d: Date): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - dayNum);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function periodKey(d: Date, period: Period): string {
  switch (period) {
    case "day":
      return localDateKey(d);
    case "week":
      return localIsoWeekKey(d);
    case "month":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    case "year":
      return String(d.getFullYear());
  }
}

/** Buckets closed trades by local day/week/month/year and computes a
 * FeeSummary per bucket, most recent first. */
export function groupFeeSummaryByPeriod(
  trades: FeeTrade[],
  profile: FeeProfileLike | null,
  taxSetAsidePct: number | null,
  period: Period,
): PeriodFeeSummary[] {
  const buckets = new Map<string, FeeTrade[]>();
  for (const t of trades) {
    if (!t.closedAt) continue;
    const key = periodKey(t.closedAt, period);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }
  return Array.from(buckets.entries())
    .map(([key, rows]) => ({ key, summary: computeFeeSummary(rows, profile, taxSetAsidePct) }))
    .sort((a, b) => b.key.localeCompare(a.key));
}
