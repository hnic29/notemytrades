import { parseFilters } from "@/lib/filters";
import { fetchReportTrades } from "@/lib/queries/reports";
import { computeRiskMetrics } from "@/lib/analytics/grouping";
import { computeDrawdown, computeEquityCurve } from "@/lib/analytics/stats";
import { StatCard } from "@/components/dashboard/StatCard";
import { DrawdownChart } from "@/components/dashboard/DrawdownChart";
import { formatCurrency } from "@/lib/format";

export default async function RiskReportPage(props: PageProps<"/reports/risk">) {
  const searchParams = await props.searchParams;
  const trades = await fetchReportTrades(parseFilters(searchParams));
  const risk = computeRiskMetrics(trades);
  const equityCurve = computeEquityCurve(trades);
  const drawdown = computeDrawdown(equityCurve);

  return (
    <div className="space-y-6">
      {risk.tradesWithRiskDefined === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-text-muted">
          None of these trades have a stop loss recorded, so there&apos;s no planned-risk
          baseline to measure against. Set a stop loss when logging a trade to unlock
          risk/reward and R-multiple metrics.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Trades w/ Stop Defined"
            value={String(risk.tradesWithRiskDefined)}
            sub={`of ${trades.filter((t) => t.closedAt).length} closed`}
          />
          <StatCard
            label="Avg $ Risked / Trade"
            value={risk.avgRiskPerTrade != null ? formatCurrency(risk.avgRiskPerTrade) : "—"}
          />
          <StatCard
            label="Avg Planned Reward:Risk"
            value={risk.avgRewardToRisk != null ? `${risk.avgRewardToRisk.toFixed(2)}:1` : "—"}
          />
          <StatCard
            label="Avg Realized R-Multiple"
            value={risk.avgRMultiple != null ? `${risk.avgRMultiple.toFixed(2)}R` : "—"}
            tone={risk.avgRMultiple != null && risk.avgRMultiple >= 0 ? "profit" : "loss"}
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Drawdown</h2>
        <DrawdownChart data={drawdown.series} />
        <p className="mt-3 text-xs text-text-faint">
          Max drawdown: {formatCurrency(drawdown.maxDrawdown)} (
          {(drawdown.maxDrawdownPct * 100).toFixed(1)}% from peak equity)
        </p>
      </div>
    </div>
  );
}
