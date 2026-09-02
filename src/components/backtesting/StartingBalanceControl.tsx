"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";

export function StartingBalanceControl({
  accountId,
  startingBalance,
  onSave,
}: {
  accountId: string;
  startingBalance: number;
  onSave: (accountId: string, value: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(startingBalance || ""));
  const [isPending, startTransition] = useTransition();

  if (startingBalance > 0 && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-text-faint hover:text-text-muted"
      >
        Starting balance: {formatCurrency(startingBalance)} (edit)
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1.5 text-xs">
      <span className="text-text-muted">
        {startingBalance <= 0
          ? "Set a starting balance to enable risk-% position sizing:"
          : "Starting balance:"}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="10000"
        className="w-24 rounded border border-border-strong bg-surface px-1.5 py-0.5 text-text outline-none focus:border-accent"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await onSave(accountId, Number(value) || 0);
            setEditing(false);
          })
        }
        className="rounded bg-accent px-2 py-0.5 text-accent-fg hover:bg-accent-strong disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
