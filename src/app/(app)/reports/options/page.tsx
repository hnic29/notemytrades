import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { bySymbol } from "@/lib/analytics/grouping";
import { StatCard } from "@/components/dashboard/StatCard";
import { GroupedStatsTable } from "@/components/reports/GroupedStatsTable";
import { formatCurrency, formatPercent } from "@/lib/format";

export default async function OptionsReportPage(props: PageProps<"/reports/options">) {
  const searchParams = await props.searchParams;
  const trades = (await fetchReportTrades(parseFilters(searchParams))).filter(
    (t) => t.assetType === "option",
  );
  const stats = computeSummaryStats(trades);
  const groups = bySymbol(trades);

  return (
    <div className="space-y-6">
      <p className="text-xs text-text-faint">
        Basic P&amp;L stats for trades logged as options. Strike, expiration, and Greeks
        aren&apos;t modeled yet — this covers the same metrics as the other reports, scoped
        to option trades.
      </p>

      {trades.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-text-muted">
          No option trades match these filters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Net P&L"
              value={formatCurrency(stats.netPnl)}
              tone={stats.netPnl >= 0 ? "profit" : "loss"}
            />
            <StatCard
              label="Win Rate"
              value={stats.winRate != null ? formatPercent(stats.winRate) : "—"}
            />
            <StatCard
              label="Profit Factor"
              value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
            />
            <StatCard label="Closed Trades" value={String(stats.closedTrades)} />
          </div>
          <GroupedStatsTable groups={groups} labelHeader="Underlying" />
        </>
      )}
    </div>
  );
}
