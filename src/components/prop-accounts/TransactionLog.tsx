"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addTransaction, deleteTransaction } from "@/lib/actions/prop-accounts";
import { formatCurrency, formatDate, toDatetimeLocalValue } from "@/lib/format";
import { cn } from "@/lib/utils";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  occurredAt: Date;
  notes: string | null;
};

const TYPES = ["fee", "deposit", "adjustment", "reset"];

export function TransactionLog({
  propAccountId,
  transactions,
}: {
  propAccountId: string;
  transactions: Transaction[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("fee");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocalValue(new Date()));
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt === 0) return;
    startTransition(async () => {
      await addTransaction(propAccountId, { type, amount: amt, occurredAt, notes });
      setAmount("");
      setNotes("");
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div>
      {transactions.length === 0 ? (
        <p className="mb-3 text-sm text-text-faint">No transactions logged.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {transactions.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <div>
                <span className="capitalize text-text">{t.type}</span>{" "}
                <span className="text-text-faint">· {formatDate(t.occurredAt)}</span>
                {t.notes && <span className="text-text-muted"> — {t.notes}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("font-medium", t.amount >= 0 ? "text-profit" : "text-loss")}>
                  {formatCurrency(t.amount)}
                </span>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      await deleteTransaction(t.id, propAccountId);
                      router.refresh();
                    })
                  }
                  className="text-text-faint hover:text-loss"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="space-y-2 rounded-md border border-border bg-surface p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (negative for fees)"
              className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
          </div>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
            >
              Add
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
          <Plus className="h-3.5 w-3.5" /> Add a transaction
        </button>
      )}
    </div>
  );
}
