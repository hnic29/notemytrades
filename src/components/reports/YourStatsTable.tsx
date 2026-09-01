import type { DetailedStats } from "@/lib/analytics/detailed-stats";
import type { RiskMetrics } from "@/lib/analytics/grouping";
import type { SummaryStats } from "@/lib/analytics/stats";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function YourStatsTable({
  stats,
  detailed,
  risk,
}: {
  stats: SummaryStats;
  detailed: DetailedStats;
  risk: RiskMetrics;
}) {
  const leftRows: [string, string][] = [
    ["Total P&L", formatCurrency(stats.netPnl)],
    ["Average Daily P&L", formatCurrency(detailed.avgDailyPnl)],
    ["Average Winning Trade", formatCurrency(stats.avgWin)],
    ["Average Losing Trade", formatCurrency(-stats.avgLoss)],
    ["Total Number of Trades", String(stats.closedTrades)],
    ["Number of Winning Trades", String(stats.wins)],
    ["Number of Losing Trades", String(stats.losses)],
    ["Number of Breakeven Trades", String(stats.breakeven)],
    ["Max Consecutive Wins", String(Math.max(stats.currentStreak, 0))],
    ["Total Commissions", formatCurrency(detailed.totalCommissions)],
    ["Total Fees", formatCurrency(detailed.totalFees)],
    ["Largest Profit", formatCurrency(detailed.largestWin)],
    ["Largest Loss", formatCurrency(detailed.largestLoss)],
    ["Average Hold Time (All Trades)", formatMinutes(detailed.avgHoldMinutesAll)],
    ["Average Hold Time (Winning Trades)", formatMinutes(detailed.avgHoldMinutesWinning)],
    ["Average Hold Time (Losing Trades)", formatMinutes(detailed.avgHoldMinutesLosing)],
  ];

  const rightRows: [string, string][] = [
    ["Profit Factor", stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"],
    ["Trade Expectancy", formatCurrency(detailed.expectancy)],
    ["Total Trading Days", String(detailed.totalTradingDays)],
    ["Winning Days", String(detailed.winningDays)],
    ["Losing Days", String(detailed.losingDays)],
    ["Breakeven Days", String(detailed.breakevenDays)],
    ["Max Consecutive Winning Days", String(detailed.maxConsecutiveWinningDays)],
    ["Max Consecutive Losing Days", String(detailed.maxConsecutiveLosingDays)],
    ["Average Winning Day P&L", formatCurrency(detailed.avgWinningDayPnl)],
    ["Average Losing Day P&L", formatCurrency(detailed.avgLosingDayPnl)],
    ["Largest Profitable Day", formatCurrency(detailed.largestProfitableDay)],
    ["Largest Losing Day", formatCurrency(detailed.largestLosingDay)],
    [
      "Average Planned Reward:Risk",
      risk.avgRewardToRisk != null ? `${risk.avgRewardToRisk.toFixed(2)}:1` : "—",
    ],
    ["Average Realized R-Multiple", risk.avgRMultiple != null ? `${risk.avgRMultiple.toFixed(2)}R` : "—"],
  ];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Your Stats (All Dates)</h2>
        <div className="grid grid-cols-3 gap-4">
          <MonthStat label="Best Month" month={detailed.bestMonth} tone="profit" />
          <MonthStat label="Lowest Month" month={detailed.lowestMonth} tone="loss" />
          <div className="rounded-md border border-border bg-bg p-3">
            <div className="text-xs text-text-faint">Average</div>
            <div
              className={cn(
                "mt-1 text-lg font-semibold",
                detailed.avgMonth >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {formatCurrency(detailed.avgMonth)}
            </div>
            <div className="text-xs text-text-faint">per month</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
        <StatRows rows={leftRows} />
        <StatRows rows={rightRows} />
      </div>
    </div>
  );
}

function MonthStat({
  label,
  month,
  tone,
}: {
  label: string;
  month: { label: string; value: number } | null;
  tone: "profit" | "loss";
}) {
  return (
    <div className="rounded-md border border-border bg-bg p-3">
      <div className="text-xs text-text-faint">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold", tone === "profit" ? "text-profit" : "text-loss")}>
        {month ? formatCurrency(month.value) : "—"}
      </div>
      <div className="text-xs text-text-faint">{month?.label ?? "no data yet"}</div>
    </div>
  );
}

function StatRows({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-border last:border-0">
            <td className="py-2 text-text-muted">{label}</td>
            <td className="py-2 text-right font-medium text-text">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
