import type { ReportTrade } from "@/lib/analytics/grouping";

type SessionTradeForReport = {
  symbol: string;
  side: string;
  assetType: string;
  stopLoss: number | null;
  profitTarget: number | null;
  avgEntryPrice: number;
  quantity: number;
  multiplier: number;
  fees: number;
  commissions: number;
  netPnl: number;
  openedAt: Date;
  closedAt: Date | null;
  tags?: { tag: { name: string } }[];
};

/**
 * Adapts backtest Trade rows into the shape byHourOfDay/byDayOfWeek
 * (src/lib/analytics/grouping.ts) already expect, so "best trade times"
 * reuses those groupers instead of duplicating grouping logic here.
 */
export function toReportTrades(trades: SessionTradeForReport[]): ReportTrade[] {
  return trades.map((t) => ({
    symbol: t.symbol,
    side: t.side as "long" | "short",
    assetType: t.assetType,
    tagNames: t.tags?.map((tt) => tt.tag.name) ?? [],
    strategyName: null,
    stopLoss: t.stopLoss,
    profitTarget: t.profitTarget,
    avgEntryPrice: t.avgEntryPrice,
    quantity: t.quantity,
    multiplier: t.multiplier,
    fees: t.fees,
    commissions: t.commissions,
    netPnl: t.netPnl,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
  }));
}
