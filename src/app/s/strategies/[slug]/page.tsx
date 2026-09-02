import { notFound } from "next/navigation";
import { getStrategyByShareSlug, parseRules } from "@/lib/queries/strategies";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { RulesChecklist } from "@/components/strategies/RulesChecklist";
import { Logo } from "@/components/layout/Logo";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SharedStrategyPage(props: PageProps<"/s/strategies/[slug]">) {
  const { slug } = await props.params;
  const strategy = await getStrategyByShareSlug(slug);
  if (!strategy) notFound();

  const stats = computeSummaryStats(strategy.trades);
  const rules = parseRules(strategy.rulesJson);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-text-faint">
          <Logo className="h-[38px] w-[38px] shrink-0 object-contain" />
          Shared from Note My Trades
        </div>

        <h1 className="mb-1 text-2xl font-semibold">{strategy.name}</h1>
        {strategy.description && (
          <p className="mb-6 text-sm text-text-muted">{strategy.description}</p>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Net P&L"
            value={formatCurrency(stats.netPnl)}
            tone={stats.netPnl >= 0 ? "profit" : "loss"}
          />
          <Stat label="Win Rate" value={stats.winRate != null ? formatPercent(stats.winRate) : "—"} />
          <Stat
            label="Profit Factor"
            value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
          />
          <Stat label="Trades" value={String(stats.closedTrades)} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-text-muted">Rules</h2>
          <RulesChecklist strategyId={strategy.id} groups={rules} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          !tone && "text-text",
        )}
      >
        {value}
      </div>
    </div>
  );
}
