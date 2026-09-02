import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";
import { listStrategies } from "@/lib/queries/strategies";
import { formatCurrency, formatPercent } from "@/lib/format";
import { RingStat } from "@/components/dashboard/RingStat";
import { cn } from "@/lib/utils";

export default async function StrategiesPage() {
  const strategies = await listStrategies();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Strategies</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/strategies/templates"
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm text-text hover:bg-surface-2"
          >
            <LayoutTemplate className="h-4 w-4" /> Browse Templates
          </Link>
          <Link
            href="/strategies/new"
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
          >
            <Plus className="h-4 w-4" /> New Strategy
          </Link>
        </div>
      </div>

      {strategies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-text-muted">
          <p className="mb-3">No strategies yet. Create a playbook to define your rules and track how it performs.</p>
          <Link href="/strategies/templates" className="text-sm text-accent hover:underline">
            Or start from a template — no blank page
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {strategies.map((s) => (
            <Link
              key={s.id}
              href={`/strategies/${s.id}`}
              className="rounded-lg border border-border bg-surface p-4 hover:border-border-strong"
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-medium text-text">{s.name}</h2>
                {s._count.trades > 0 && (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      s.netPnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(s.netPnl)}
                  </span>
                )}
              </div>
              {s.description && (
                <p className="mb-3 line-clamp-2 text-sm text-text-muted">{s.description}</p>
              )}
              {s._count.trades > 0 && (
                <div className="mb-3">
                  <RingStat
                    label="Win Rate"
                    value={s.winRate}
                    displayValue={s.winRate != null ? formatPercent(s.winRate, 0) : "—"}
                    tone="profit"
                  />
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-text-faint">
                <span>{s._count.trades} trades</span>
                {s._count.missedTrades > 0 && <span>{s._count.missedTrades} missed</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
