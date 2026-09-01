import Link from "next/link";
import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { byStrategy } from "@/lib/analytics/grouping";
import { GroupedBarChart } from "@/components/reports/GroupedBarChart";
import { GroupedStatsTable } from "@/components/reports/GroupedStatsTable";

export default async function PlaybookReportPage(props: PageProps<"/reports/playbook">) {
  const searchParams = await props.searchParams;
  const trades = await fetchReportTrades(parseFilters(searchParams));
  const groups = byStrategy(trades);
  const hasAssigned = groups.some((g) => g.key !== "Unassigned");

  return (
    <div className="space-y-6">
      {!hasAssigned && (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-text-muted">
          All trades are currently unassigned to a strategy.{" "}
          <Link href="/strategies" className="text-accent hover:underline">
            Create a playbook
          </Link>{" "}
          and attach trades to it to break performance down by strategy here.
        </div>
      )}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Net P&L by Playbook</h2>
        <GroupedBarChart groups={groups} />
      </div>
      <GroupedStatsTable groups={groups} labelHeader="Playbook" />
    </div>
  );
}
