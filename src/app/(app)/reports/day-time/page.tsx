import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { byDayOfWeek, byHourOfDay } from "@/lib/analytics/grouping";
import { GroupedBarChart } from "@/components/reports/GroupedBarChart";
import { GroupedStatsTable } from "@/components/reports/GroupedStatsTable";

export default async function DayTimeReportPage(props: PageProps<"/reports/day-time">) {
  const searchParams = await props.searchParams;
  const trades = await fetchReportTrades(parseFilters(searchParams));

  const dayGroups = byDayOfWeek(trades);
  const hourGroups = byHourOfDay(trades);

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
      <GroupedStatsTable groups={dayGroups} labelHeader="Day" />
    </div>
  );
}
