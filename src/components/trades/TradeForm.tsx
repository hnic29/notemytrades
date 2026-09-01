"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createManualTrade, updateTrade, type ManualTradeInput } from "@/lib/actions/trades";
import { toDatetimeLocalValue } from "@/lib/format";
import { cn } from "@/lib/utils";

type AccountOption = { id: string; name: string };

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "futures", label: "Futures" },
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
  { value: "option", label: "Option" },
];

export type TradeFormInitial = {
  id?: string;
  accountId: string;
  symbol: string;
  assetType: string;
  side: "long" | "short";
  quantity: number;
  multiplier: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  openedAt: string;
  closedAt: string | null;
  fees: number;
  commissions: number;
  stopLoss: number | null;
  profitTarget: number | null;
  quickNote: string | null;
  tagNames: string[];
};

const DEFAULTS: Omit<TradeFormInitial, "accountId"> = {
  symbol: "",
  assetType: "stock",
  side: "long",
  quantity: 100,
  multiplier: 1,
  avgEntryPrice: 0,
  avgExitPrice: null,
  openedAt: toDatetimeLocalValue(new Date()),
  closedAt: null,
  fees: 0,
  commissions: 0,
  stopLoss: null,
  profitTarget: null,
  quickNote: null,
  tagNames: [],
};

export function TradeForm({
  accounts,
  initial,
}: {
  accounts: AccountOption[];
  initial?: TradeFormInitial;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TradeFormInitial>(
    initial ?? { accountId: accounts[0]?.id ?? "", ...DEFAULTS },
  );
  const [tagsText, setTagsText] = useState(values.tagNames.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof TradeFormInitial>(key: K, value: TradeFormInitial[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!values.accountId) return setError("Choose an account");
    if (!values.symbol.trim()) return setError("Symbol is required");
    if (values.quantity <= 0) return setError("Quantity must be greater than 0");
    if (values.avgEntryPrice < 0) return setError("Entry price can't be negative");

    const input: ManualTradeInput = {
      ...values,
      tagNames: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    startTransition(async () => {
      try {
        const trade = initial?.id
          ? await updateTrade(initial.id, input)
          : await createManualTrade(input);
        router.push(`/trades/${trade.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save trade");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {error && (
        <div className="rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Account">
          <select
            value={values.accountId}
            onChange={(e) => set("accountId", e.target.value)}
            className={inputClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Asset Type">
          <select
            value={values.assetType}
            onChange={(e) => set("assetType", e.target.value)}
            className={inputClass}
          >
            {ASSET_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Symbol">
          <input
            value={values.symbol}
            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
            placeholder="AAPL"
            className={inputClass}
          />
        </Field>

        <Field label="Side">
          <div className="flex gap-2">
            {(["long", "short"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => set("side", s)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors",
                  values.side === s
                    ? s === "long"
                      ? "border-profit/50 bg-profit-bg text-profit"
                      : "border-loss/50 bg-loss-bg text-loss"
                    : "border-border-strong text-text-muted hover:bg-surface-2",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Quantity">
          <input
            type="number"
            step="any"
            value={values.quantity}
            onChange={(e) => set("quantity", Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Multiplier (point/contract value)">
          <input
            type="number"
            step="any"
            value={values.multiplier}
            onChange={(e) => set("multiplier", Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Entry Price">
          <input
            type="number"
            step="any"
            value={values.avgEntryPrice}
            onChange={(e) => set("avgEntryPrice", Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Exit Price (leave blank if open)">
          <input
            type="number"
            step="any"
            value={values.avgExitPrice ?? ""}
            onChange={(e) =>
              set("avgExitPrice", e.target.value === "" ? null : Number(e.target.value))
            }
            className={inputClass}
          />
        </Field>

        <Field label="Opened At">
          <input
            type="datetime-local"
            value={values.openedAt}
            onChange={(e) => set("openedAt", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Closed At">
          <input
            type="datetime-local"
            value={values.closedAt ?? ""}
            onChange={(e) => set("closedAt", e.target.value || null)}
            className={inputClass}
          />
        </Field>

        <Field label="Fees">
          <input
            type="number"
            step="any"
            value={values.fees}
            onChange={(e) => set("fees", Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Commissions">
          <input
            type="number"
            step="any"
            value={values.commissions}
            onChange={(e) => set("commissions", Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Stop Loss">
          <input
            type="number"
            step="any"
            value={values.stopLoss ?? ""}
            onChange={(e) => set("stopLoss", e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field label="Profit Target">
          <input
            type="number"
            step="any"
            value={values.profitTarget ?? ""}
            onChange={(e) =>
              set("profitTarget", e.target.value === "" ? null : Number(e.target.value))
            }
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Tags (comma separated)">
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="breakout, earnings, revenge-trade"
          className={inputClass}
        />
      </Field>

      <Field label="Quick Note">
        <textarea
          value={values.quickNote ?? ""}
          onChange={(e) => set("quickNote", e.target.value || null)}
          rows={4}
          className={inputClass}
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? "Saving…" : initial?.id ? "Save Changes" : "Add Trade"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-text-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}
