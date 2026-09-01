import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { byDayOfWeek, byHourOfDay } from "@/lib/analytics/grouping";
import { computeHoldTimeDistribution } from "@/lib/analytics/detailed-stats";
import { GroupedBarChart } from "@/components/reports/GroupedBarChart";
import { GroupedStatsTable } from "@/components/reports/GroupedStatsTable";
import { HoldTimeChart } from "@/components/reports/HoldTimeChart";

export default async function DayTimeReportPage(props: PageProps<"/reports/day-time">) {
  const searchParams = await props.searchParams;
  const trades = await fetchReportTrades(parseFilters(searchParams));

  const dayGroups = byDayOfWeek(trades);
  const hourGroups = byHourOfDay(trades);
  const holdTimeBuckets = computeHoldTimeDistribution(trades);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Net P&L by Day of Week</h2>
        <GroupedBarChart groups={dayGroups} />
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Net P&L by Hour Closed</h2>
        <GroupedBarChart groups={hourGroups} />
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Trade Duration</h2>
        <HoldTimeChart buckets={holdTimeBuckets} />
      </div>
      <GroupedStatsTable groups={dayGroups} labelHeader="Day" />
    </div>
  );
}
