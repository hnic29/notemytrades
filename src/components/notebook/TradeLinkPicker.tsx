"use client";

import { useState, useTransition } from "react";
import { Link2, Link2Off } from "lucide-react";
import { linkNoteToTrade, searchTradesToLink, unlinkNoteFromTrade } from "@/lib/actions/notebook";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type LinkedTrade = { id: string; symbol: string } | null;

export function TradeLinkPicker({
  noteId,
  linkedTrade,
}: {
  noteId: string;
  linkedTrade: LinkedTrade;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; symbol: string; openedAt: Date; netPnl: number; noteId: string | null }[]
  >([]);
  const [linked, setLinked] = useState(linkedTrade);
  const [isPending, startTransition] = useTransition();

  const search = (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      setResults(await searchTradesToLink(q));
    });
  };

  if (linked) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-muted">Linked to trade:</span>
        <a href={`/trades/${linked.id}`} className="font-medium text-accent hover:underline">
          {linked.symbol}
        </a>
        <button
          onClick={() =>
            startTransition(async () => {
              await unlinkNoteFromTrade(linked.id);
              setLinked(null);
            })
          }
          className="ml-auto flex items-center gap-1 text-xs text-text-faint hover:text-loss"
        >
          <Link2Off className="h-3 w-3" /> Unlink
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5 text-text-faint" />
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search a symbol to link this note to a trade…"
          className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border">
          {results.map((t) => (
            <button
              key={t.id}
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await linkNoteToTrade(noteId, t.id);
                  setLinked({ id: t.id, symbol: t.symbol });
                  setResults([]);
                  setQuery("");
                })
              }
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
            >
              <span className="text-text">{t.symbol}</span>
              <span className="text-text-faint">{formatDate(t.openedAt)}</span>
              <span className={cn(t.netPnl >= 0 ? "text-profit" : "text-loss")}>
                {formatCurrency(t.netPnl)}
              </span>
              {t.noteId && <span className="text-xs text-warning">has a note</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
