import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { byTag } from "@/lib/analytics/grouping";
import { GroupedBarChart } from "@/components/reports/GroupedBarChart";
import { GroupedStatsTable } from "@/components/reports/GroupedStatsTable";

export default async function TagsReportPage(props: PageProps<"/reports/tags">) {
  const searchParams = await props.searchParams;
  const trades = await fetchReportTrades(parseFilters(searchParams));
  const groups = byTag(trades);

  return (
    <div className="space-y-6">
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-text-muted">
          No tagged trades yet. Add tags when logging a trade to see performance broken down
          by tag here.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-medium text-text-muted">Net P&L by Tag</h2>
            <GroupedBarChart groups={groups} />
          </div>
          <GroupedStatsTable groups={groups} labelHeader="Tag" />
        </>
      )}
    </div>
  );
}
