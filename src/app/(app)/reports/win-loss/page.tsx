import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { computePnlDistribution, computeSummaryStats } from "@/lib/analytics/stats";
import { bySide } from "@/lib/analytics/grouping";
import { StatCard } from "@/components/dashboard/StatCard";
import { GroupedStatsTable } from "@/components/reports/GroupedStatsTable";
import { PnlDistributionChart } from "@/components/reports/PnlDistributionChart";
import { formatPercent } from "@/lib/format";

export default async function WinLossReportPage(props: PageProps<"/reports/win-loss">) {
  const searchParams = await props.searchParams;
  const trades = await fetchReportTrades(parseFilters(searchParams));
  const stats = computeSummaryStats(trades);
  const distribution = computePnlDistribution(trades);
  const sideGroups = bySide(trades);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Wins" value={String(stats.wins)} tone="profit" />
        <StatCard label="Losses" value={String(stats.losses)} tone="loss" />
        <StatCard label="Breakeven" value={String(stats.breakeven)} />
        <StatCard
          label="Win Rate"
          value={stats.winRate != null ? formatPercent(stats.winRate) : "—"}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">P&amp;L Distribution</h2>
        <PnlDistributionChart buckets={distribution} />
      </div>

      <GroupedStatsTable groups={sideGroups} labelHeader="Side" />
    </div>
  );
}
