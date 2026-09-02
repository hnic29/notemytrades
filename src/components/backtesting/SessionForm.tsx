"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSession } from "@/lib/actions/backtesting";
import { TIMEFRAME_OPTIONS, type Timeframe } from "@/lib/market-data/yahoo";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function SessionForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [assetType, setAssetType] = useState<"stock" | "crypto" | "forex">("stock");
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [startDate, setStartDate] = useState(daysAgo(5));
  const [endDate, setEndDate] = useState(daysAgo(0));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeOption = TIMEFRAME_OPTIONS.find((t) => t.value === timeframe)!;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!symbol.trim()) return setError("Symbol is required");

    startTransition(async () => {
      try {
        const session = await createSession({ name, symbol, assetType, timeframe, startDate, endDate });
        router.push(`/backtesting/${session.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create session");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {error && (
        <div className="rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">
          {error}
        </div>
      )}

      <Field label="Session Name (optional)">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="AAPL opening range practice"
          className={inputClass}
        />
      </Field>

      <Field label="Symbol">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder={
            assetType === "crypto" ? "BTC" : assetType === "forex" ? "EURUSD" : "AAPL"
          }
          className={inputClass}
        />
        {assetType === "forex" && (
          <p className="mt-1 text-xs text-text-faint">
            Six-letter pair, base then quote — e.g. EURUSD, GBPJPY.
          </p>
        )}
      </Field>

      <Field label="Asset Type">
        <select
          value={assetType}
          onChange={(e) => setAssetType(e.target.value as "stock" | "crypto" | "forex")}
          className={inputClass}
        >
          <option value="stock">Stock</option>
          <option value="crypto">Crypto</option>
          <option value="forex">Forex</option>
        </select>
      </Field>

      <Field label="Timeframe">
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          className={inputClass}
        >
          {TIMEFRAME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-faint">
          Yahoo Finance limits {activeOption.label} data to roughly the last{" "}
          {activeOption.maxRangeDays >= 365
            ? `${Math.round(activeOption.maxRangeDays / 365)} year(s)`
            : `${activeOption.maxRangeDays} days`}
          . Older ranges will come back empty.
        </p>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="End Date">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? "Loading chart…" : "Start Session"}
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
