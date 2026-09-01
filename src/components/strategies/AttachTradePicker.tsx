"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { assignTradeToStrategy, searchTradesToAttach } from "@/lib/actions/strategies";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AttachTradePicker({ strategyId }: { strategyId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; symbol: string; openedAt: Date; netPnl: number; strategyId: string | null }[]
  >([]);
  const [isPending, startTransition] = useTransition();
  const [justAttached, setJustAttached] = useState<string | null>(null);

  const search = (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => setResults(await searchTradesToAttach(q)));
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5 text-text-faint" />
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search a symbol to attach a trade to this strategy…"
          className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
          {results.map((t) => (
            <button
              key={t.id}
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await assignTradeToStrategy(t.id, strategyId);
                  setJustAttached(t.id);
                  setResults((r) => r.filter((row) => row.id !== t.id));
                  router.refresh();
                })
              }
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
            >
              <span className="text-text">{t.symbol}</span>
              <span className="text-text-faint">{formatDate(t.openedAt)}</span>
              <span className={cn(t.netPnl >= 0 ? "text-profit" : "text-loss")}>
                {formatCurrency(t.netPnl)}
              </span>
              {t.strategyId && <span className="text-xs text-warning">reassign</span>}
            </button>
          ))}
        </div>
      )}
      {justAttached && results.length === 0 && query && (
        <p className="mt-2 text-xs text-profit">Attached.</p>
      )}
    </div>
  );
}
