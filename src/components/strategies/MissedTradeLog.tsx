"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { deleteMissedTrade, logMissedTrade } from "@/lib/actions/strategies";
import { formatDate, toDatetimeLocalValue } from "@/lib/format";

type MissedTrade = { id: string; symbol: string; notes: string | null; occurredAt: Date };

export function MissedTradeLog({
  strategyId,
  missedTrades,
}: {
  strategyId: string;
  missedTrades: MissedTrade[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocalValue(new Date()));
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!symbol.trim()) return;
    startTransition(async () => {
      await logMissedTrade(strategyId, { symbol, notes, occurredAt });
      setSymbol("");
      setNotes("");
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div>
      {missedTrades.length === 0 ? (
        <p className="mb-3 text-sm text-text-faint">
          No missed trades logged. Track setups you saw but didn&apos;t take.
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {missedTrades.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-text">{m.symbol}</span>{" "}
                <span className="text-text-faint">· {formatDate(m.occurredAt)}</span>
                {m.notes && <p className="mt-0.5 text-text-muted">{m.notes}</p>}
              </div>
              <button
                onClick={() =>
                  startTransition(async () => {
                    await deleteMissedTrade(m.id, strategyId);
                    router.refresh();
                  })
                }
                className="shrink-0 text-text-faint hover:text-loss"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="space-y-2 rounded-md border border-border bg-surface p-3">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol"
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why didn't you take it?"
            rows={2}
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
            >
              Log It
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-text-faint hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Log a missed trade
        </button>
      )}
    </div>
  );
}
