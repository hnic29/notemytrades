"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReplayableTrade } from "@/lib/queries/trades";

/**
 * Pick any already-closed trade and jump straight into replaying its
 * real historical price action — the entry point the video calls out
 * ("pick whatever recent trade you want to play"), previously only
 * reachable from a specific trade's own detail page.
 */
export function TradeReplayPicker({ trades }: { trades: ReplayableTrade[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return trades;
    return trades.filter((t) => t.symbol.toUpperCase().includes(q));
  }, [trades, query]);

  if (trades.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-text-faint">
        No closed trades yet — replay needs a trade with both an entry and an exit. Log or import a
        trade first.
      </p>
    );
  }

  return (
    <div>
      <div className="relative mb-4 max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by symbol…"
          className="w-full rounded-md border border-border-strong bg-surface py-2 pl-8 pr-3 text-sm text-text outline-none focus:border-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-text-faint">
          No closed trades match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-text-faint">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Side</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Entry</th>
                <th className="px-3 py-2">Exit</th>
                <th className="px-3 py-2">Net P&L</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="px-3 py-2 text-text-muted">{formatDate(t.openedAt)}</td>
                  <td className="px-3 py-2 font-medium text-text">{t.symbol}</td>
                  <td className="px-3 py-2 capitalize text-text-muted">{t.side}</td>
                  <td className="px-3 py-2 text-text-muted">{t.quantity}</td>
                  <td className="px-3 py-2 text-text-muted">{formatCurrency(t.avgEntryPrice)}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {t.avgExitPrice != null ? formatCurrency(t.avgExitPrice) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 font-medium",
                      t.netPnl >= 0 ? "text-profit" : "text-loss",
                    )}
                  >
                    {formatCurrency(t.netPnl)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/trades/${t.id}/replay`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 text-xs text-text hover:bg-surface-2"
                    >
                      <History className="h-3.5 w-3.5" /> Replay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
