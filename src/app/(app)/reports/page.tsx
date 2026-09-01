import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import {
  computeDailyPnl,
  computeEquityCurve,
  computeSummaryStats,
} from "@/lib/analytics/stats";
import { byMonth, byWeek, computeRiskMetrics } from "@/lib/analytics/grouping";
import { computeDetailedStats } from "@/lib/analytics/detailed-stats";
import { StatCard } from "@/components/dashboard/StatCard";
import { EquityCurveChart } from "@/components/dashboard/EquityCurveChart";
import { CalendarHeatmap } from "@/components/dashboard/CalendarHeatmap";
import { ReportInsight } from "@/components/ai/ReportInsight";
import { YourStatsTable } from "@/components/reports/YourStatsTable";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ReportsOverviewPage(props: PageProps<"/reports">) {
  const searchParams = await props.searchParams;
  const filters = parseFilters(searchParams);
  const trades = await fetchReportTrades(filters);

  const stats = computeSummaryStats(trades);
  const detailed = computeDetailedStats(trades);
  const risk = computeRiskMetrics(trades);
  const equityCurve = computeEquityCurve(trades);
  const dailyPnl = Object.fromEntries(computeDailyPnl(trades));
  const monthly = byMonth(trades);
  const weekly = byWeek(trades);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Net P&L"
          value={formatCurrency(stats.netPnl)}
          tone={stats.netPnl >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="Win Rate"
          value={stats.winRate != null ? formatPercent(stats.winRate) : "—"}
          sub={`${stats.wins}W / ${stats.losses}L`}
        />
        <StatCard
          label="Profit Factor"
          value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
        />
        <StatCard label="Closed Trades" value={String(stats.closedTrades)} />
      </div>

      <ReportInsight />

      <YourStatsTable stats={stats} detailed={detailed} risk={risk} />

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Equity Curve</h2>
        <EquityCurveChart data={equityCurve} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-text-muted">Calendar</h2>
          <CalendarHeatmap dailyPnl={dailyPnl} />
        </div>

        <div className="space-y-4">
          <RollupTable title="Monthly Performance" groups={monthly} />
          <RollupTable title="Weekly Performance" groups={weekly} />
        </div>
      </div>
    </div>
  );
}

function RollupTable({
  title,
  groups,
}: {
  title: string;
  groups: { key: string; stats: { netPnl: number; closedTrades: number; winRate: number | null } }[];
}) {
  const sorted = [...groups].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 8);
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-text-muted">{title}</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-text-faint">No closed trades yet.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {sorted.map((g) => (
              <tr key={g.key} className="border-b border-border last:border-0">
                <td className="py-1.5 text-text-muted">{g.key}</td>
                <td className="py-1.5 text-text-faint">{g.stats.closedTrades} trades</td>
                <td
                  className={cn(
                    "py-1.5 text-right font-medium",
                    g.stats.netPnl >= 0 ? "text-profit" : "text-loss",
                  )}
                >
                  {formatCurrency(g.stats.netPnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
