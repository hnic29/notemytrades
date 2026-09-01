import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Group } from "@/lib/analytics/grouping";

export function GroupedStatsTable({ groups, labelHeader }: { groups: Group[]; labelHeader: string }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-text-muted">
        No closed trades match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-text-faint">
            <th className="px-3 py-2">{labelHeader}</th>
            <th className="px-3 py-2">Trades</th>
            <th className="px-3 py-2">Win Rate</th>
            <th className="px-3 py-2">Net P&L</th>
            <th className="px-3 py-2">Avg Win</th>
            <th className="px-3 py-2">Avg Loss</th>
            <th className="px-3 py-2">Profit Factor</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-b border-border last:border-0 hover:bg-surface">
              <td className="px-3 py-2 font-medium capitalize text-text">{g.label}</td>
              <td className="px-3 py-2 text-text-muted">{g.stats.closedTrades}</td>
              <td className="px-3 py-2 text-text-muted">
                {g.stats.winRate != null ? formatPercent(g.stats.winRate) : "—"}
              </td>
              <td
                className={cn(
                  "px-3 py-2 font-medium",
                  g.stats.netPnl >= 0 ? "text-profit" : "text-loss",
                )}
              >
                {formatCurrency(g.stats.netPnl)}
              </td>
              <td className="px-3 py-2 text-profit">{formatCurrency(g.stats.avgWin)}</td>
              <td className="px-3 py-2 text-loss">{formatCurrency(-g.stats.avgLoss)}</td>
              <td className="px-3 py-2 text-text-muted">
                {g.stats.profitFactor != null ? g.stats.profitFactor.toFixed(2) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
