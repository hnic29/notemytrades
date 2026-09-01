import { notFound } from "next/navigation";
import Link from "next/link";
import { getStrategy, parseRules } from "@/lib/queries/strategies";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { StatCard } from "@/components/dashboard/StatCard";
import { StrategyDetailActions } from "@/components/strategies/StrategyDetailActions";
import { RulesChecklist } from "@/components/strategies/RulesChecklist";
import { AttachTradePicker } from "@/components/strategies/AttachTradePicker";
import { MissedTradeLog } from "@/components/strategies/MissedTradeLog";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function StrategyDetailPage(props: PageProps<"/strategies/[id]">) {
  const { id } = await props.params;
  const strategy = await getStrategy(id);
  if (!strategy) notFound();

  const stats = computeSummaryStats(strategy.trades);
  const rules = parseRules(strategy.rulesJson);

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex items-center gap-2 text-sm text-text-faint">
        <Link href="/strategies" className="hover:text-text">
          Strategies
        </Link>
        <span>/</span>
        <span>{strategy.name}</span>
      </div>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">{strategy.name}</h1>
          {strategy.description && (
            <p className="mt-1 max-w-xl text-sm text-text-muted">{strategy.description}</p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <StrategyDetailActions strategyId={strategy.id} shareSlug={strategy.shareSlug} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Net P&L"
          value={formatCurrency(stats.netPnl)}
          tone={stats.netPnl >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="Win Rate"
          value={stats.winRate != null ? formatPercent(stats.winRate) : "—"}
        />
        <StatCard
          label="Profit Factor"
          value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
        />
        <StatCard label="Trades" value={String(stats.closedTrades)} />
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Rules</h2>
        <RulesChecklist groups={rules} />
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Attach a Trade</h2>
        <AttachTradePicker strategyId={strategy.id} />
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-text-muted">
          Trades ({strategy.trades.length})
        </h2>
        {strategy.trades.length === 0 ? (
          <p className="text-sm text-text-faint">No trades attached yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-text-faint">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Side</th>
                  <th className="px-3 py-2">Net P&L</th>
                  <th className="px-3 py-2">Account</th>
                </tr>
              </thead>
              <tbody>
                {strategy.trades.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-3 py-2 text-text-muted">{formatDate(t.openedAt)}</td>
                    <td className="px-3 py-2 font-medium text-text">
                      <Link href={`/trades/${t.id}`} className="hover:text-accent">
                        {t.symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-2 capitalize text-text-muted">{t.side}</td>
                    <td
                      className={cn(
                        "px-3 py-2 font-medium",
                        t.netPnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {formatCurrency(t.netPnl, t.account.currency)}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{t.account.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Missed Trades</h2>
        <MissedTradeLog strategyId={strategy.id} missedTrades={strategy.missedTrades} />
      </div>
    </div>
  );
}
