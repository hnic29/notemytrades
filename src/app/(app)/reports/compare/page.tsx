import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { bySide, bySymbol, byStrategy, byTag } from "@/lib/analytics/grouping";
import { CompareClient } from "@/components/reports/CompareClient";

export default async function CompareReportPage(props: PageProps<"/reports/compare">) {
  const searchParams = await props.searchParams;
  const trades = await fetchReportTrades(parseFilters(searchParams));

  return (
    <CompareClient
      groupsByDimension={{
        symbol: bySymbol(trades),
        tag: byTag(trades),
        strategy: byStrategy(trades),
        side: bySide(trades),
      }}
    />
  );
}
