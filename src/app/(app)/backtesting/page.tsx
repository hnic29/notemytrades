import Link from "next/link";
import { Plus } from "lucide-react";
import { listSessions } from "@/lib/queries/backtesting";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function BacktestingPage() {
  const sessions = await listSessions();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Backtesting &amp; Replay</h1>
        <Link
          href="/backtesting/new"
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          <Plus className="h-4 w-4" /> New Session
        </Link>
      </div>
      <p className="mb-6 text-sm text-text-faint">
        Chart data comes from Yahoo Finance&apos;s free feed — intraday history is capped at a
        few weeks to a couple months depending on timeframe, and there&apos;s no tick data, so
        this is candle-by-candle replay, not true tick-by-tick.
      </p>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-text-muted">
          No backtesting sessions yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => {
            const stats = computeSummaryStats(s.trades);
            return (
              <Link
                key={s.id}
                href={`/backtesting/${s.id}`}
                className="rounded-lg border border-border bg-surface p-4 hover:border-border-strong"
              >
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="font-medium text-text">{s.name}</h2>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] capitalize",
                      s.status === "completed"
                        ? "border-profit/40 text-profit"
                        : "border-border-strong text-text-faint",
                    )}
                  >
                    {s.status === "completed" ? "completed" : "in progress"}
                  </span>
                </div>
                <p className="mb-3 text-xs text-text-faint">
                  {s.symbol} · {s.timeframe} · {formatDate(s.startDate)} – {formatDate(s.endDate)}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{stats.closedTrades} trades</span>
                  <span
                    className={cn(
                      "font-medium",
                      stats.netPnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(stats.netPnl)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
