"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addPayout, deletePayout, updatePayoutStatus } from "@/lib/actions/prop-accounts";
import { formatCurrency, formatDate, toDatetimeLocalValue } from "@/lib/format";
import { cn } from "@/lib/utils";

type Payout = {
  id: string;
  amount: number;
  requestedAt: Date;
  paidAt: Date | null;
  status: string;
};

export function PayoutLog({
  propAccountId,
  payouts,
}: {
  propAccountId: string;
  payouts: Payout[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [requestedAt, setRequestedAt] = useState(toDatetimeLocalValue(new Date()));
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    startTransition(async () => {
      await addPayout(propAccountId, { amount: amt, requestedAt });
      setAmount("");
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div>
      {payouts.length === 0 ? (
        <p className="mb-3 text-sm text-text-faint">No payouts logged.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {payouts.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-profit">{formatCurrency(p.amount)}</span>{" "}
                <span className="text-text-faint">· requested {formatDate(p.requestedAt)}</span>
                {p.paidAt && <span className="text-text-faint"> · paid {formatDate(p.paidAt)}</span>}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={p.status}
                  onChange={(e) =>
                    startTransition(async () => {
                      await updatePayoutStatus(
                        p.id,
                        propAccountId,
                        e.target.value as "pending" | "paid" | "denied",
                      );
                      router.refresh();
                    })
                  }
                  className={cn(
                    "rounded-md border bg-surface px-2 py-1 text-xs capitalize outline-none",
                    p.status === "paid" && "border-profit/40 text-profit",
                    p.status === "denied" && "border-loss/40 text-loss",
                    p.status === "pending" && "border-border-strong text-text-muted",
                  )}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="denied">Denied</option>
                </select>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      await deletePayout(p.id, propAccountId);
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
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Payout amount"
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <input
            type="datetime-local"
            value={requestedAt}
            onChange={(e) => setRequestedAt(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
            >
              Log Payout
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
          <Plus className="h-3.5 w-3.5" /> Log a payout
        </button>
      )}
    </div>
  );
}
