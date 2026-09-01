import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { bySymbol } from "@/lib/analytics/grouping";
import { GroupedBarChart } from "@/components/reports/GroupedBarChart";
import { GroupedStatsTable } from "@/components/reports/GroupedStatsTable";

export default async function SymbolReportPage(props: PageProps<"/reports/symbol">) {
  const searchParams = await props.searchParams;
  const trades = await fetchReportTrades(parseFilters(searchParams));
  const groups = bySymbol(trades);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Net P&L by Symbol</h2>
        <GroupedBarChart groups={groups.slice(0, 15)} />
      </div>
      <GroupedStatsTable groups={groups} labelHeader="Symbol" />
    </div>
  );
}
