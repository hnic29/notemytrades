"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, Info, Plus, Trash2 } from "lucide-react";
import {
  computeFeeSummary,
  groupFeeSummaryByPeriod,
  type FeeTrade,
  type Period,
} from "@/lib/analytics/fees";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  createCustomBrokerProfile,
  deleteCustomBrokerProfile,
  selectBrokerProfile,
  setTaxSetAsidePct,
  type BrokerProfileInput,
} from "@/lib/actions/broker-fees";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  name: string;
  isCustom: boolean;
  perContractFeeFutures: number | null;
  perContractFeeOptions: number | null;
  perShareFeeStock: number | null;
  minFeePerOrder: number | null;
  monthlyPlatformFee: number | null;
  sourceUrl: string | null;
  feesAsOf: string | null;
  notes: string | null;
};

type TradeRow = {
  id: string;
  symbol: string;
  assetType: string;
  quantity: number;
  avgExitPrice: number | null;
  closedAt: string | null;
  grossPnl: number;
  fees: number;
  commissions: number;
};

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

function periodLabel(key: string, period: Period) {
  if (period === "week") return `Week of ${key.split("-W")[0]}, wk ${key.split("-W")[1]}`;
  if (period === "day") return formatDate(key);
  return key;
}

export function TakeHomeView({
  profiles,
  trades,
  selectedBrokerProfileId,
  taxSetAsidePct,
}: {
  profiles: Profile[];
  trades: TradeRow[];
  selectedBrokerProfileId: string | null;
  taxSetAsidePct: number | null;
}) {
  const [profileId, setProfileId] = useState(selectedBrokerProfileId ?? "");
  const [taxPct, setTaxPct] = useState(taxSetAsidePct != null ? String(taxSetAsidePct) : "");
  const [period, setPeriod] = useState<Period>("day");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const feeTrades: FeeTrade[] = useMemo(
    () =>
      trades.map((t) => ({
        assetType: t.assetType,
        quantity: t.quantity,
        avgExitPrice: t.avgExitPrice,
        closedAt: t.closedAt ? new Date(t.closedAt) : null,
        grossPnl: t.grossPnl,
        fees: t.fees,
        commissions: t.commissions,
      })),
    [trades],
  );

  const profile = profiles.find((p) => p.id === profileId) ?? null;
  const parsedTaxPct = taxPct.trim() === "" ? null : Number(taxPct);
  const effectiveTaxPct = parsedTaxPct != null && Number.isFinite(parsedTaxPct) ? parsedTaxPct : null;

  const allTime = useMemo(
    () => computeFeeSummary(feeTrades, profile, effectiveTaxPct),
    [feeTrades, profile, effectiveTaxPct],
  );
  const byPeriod = useMemo(
    () => groupFeeSummaryByPeriod(feeTrades, profile, effectiveTaxPct, period),
    [feeTrades, profile, effectiveTaxPct, period],
  );

  const applyProfile = (id: string) => {
    setProfileId(id);
    startTransition(() => selectBrokerProfile(id || null));
  };

  const applyTaxPct = () => {
    startTransition(() => setTaxSetAsidePct(effectiveTaxPct));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-text-muted">Broker</span>
            <select
              value={profileId}
              onChange={(e) => applyProfile(e.target.value)}
              className="w-64 rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-text"
            >
              <option value="">No broker selected — use recorded fees only</option>
              <optgroup label="Researched defaults">
                {profiles
                  .filter((p) => !p.isCustom)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
              {profiles.some((p) => p.isCustom) && (
                <optgroup label="Your custom brokers">
                  {profiles
                    .filter((p) => p.isCustom)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-text-muted">
              Optional: set aside for taxes (%)
            </span>
            <input
              type="number"
              step="any"
              min={0}
              max={100}
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              onBlur={applyTaxPct}
              placeholder="e.g. 25"
              className="w-40 rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-text"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm text-text hover:bg-surface-2"
          >
            <Plus className="h-3.5 w-3.5" /> Add custom broker
          </button>
        </div>

        {profile && (
          <ProfileDetail profile={profile} />
        )}

        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-faint">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Not tax or financial advice. Broker rates are researched estimates, applied only where
            a trade has no real recorded fee (this is exactly what TradingView Paper Trading fills
            look like) — trades that already carry a real commission always use that real number
            instead. Verify current pricing against your broker before relying on these figures.
            The tax set-aside is purely your own number multiplied through; this app never asserts
            a tax rate.
          </p>
        </div>
      </div>

      {showAddForm && (
        <AddBrokerForm onDone={() => setShowAddForm(false)} onCreated={(id) => applyProfile(id)} />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Gross P&L (all time)" value={formatCurrency(allTime.grossPnl)} tone={allTime.grossPnl >= 0 ? "profit" : "loss"} />
        <StatCard label="Estimated fees" value={formatCurrency(allTime.totalFees)} />
        <StatCard
          label="Take-home"
          value={formatCurrency(allTime.netPnl)}
          tone={allTime.netPnl >= 0 ? "profit" : "loss"}
          sub={effectiveTaxPct != null ? `${formatCurrency(allTime.afterTax)} after tax set-aside` : undefined}
        />
        <StatCard label="Closed trades counted" value={String(allTime.tradeCount)} sub={allTime.uncoveredTradeCount > 0 ? `${allTime.uncoveredTradeCount} not covered by this broker's rates` : undefined} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-muted">Breakdown</h2>
          <div className="flex rounded-md border border-border-strong text-xs">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "px-3 py-1.5",
                  period === p.key ? "bg-accent text-accent-fg" : "text-text-muted hover:bg-surface-2",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {byPeriod.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-faint">No closed trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-faint">
                  <th className="py-2 pr-4">{PERIODS.find((p) => p.key === period)?.label}</th>
                  <th className="py-2 pr-4 text-right">Trades</th>
                  <th className="py-2 pr-4 text-right">Gross P&amp;L</th>
                  <th className="py-2 pr-4 text-right">Est. fees</th>
                  <th className="py-2 pr-4 text-right">Take-home</th>
                  {effectiveTaxPct != null && <th className="py-2 pr-4 text-right">After tax set-aside</th>}
                </tr>
              </thead>
              <tbody>
                {byPeriod.map(({ key, summary }) => (
                  <tr key={key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 text-text">{periodLabel(key, period)}</td>
                    <td className="py-2 pr-4 text-right text-text-muted">{summary.tradeCount}</td>
                    <td className={cn("py-2 pr-4 text-right", summary.grossPnl >= 0 ? "text-profit" : "text-loss")}>
                      {formatCurrency(summary.grossPnl)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-muted">{formatCurrency(summary.totalFees)}</td>
                    <td className={cn("py-2 pr-4 text-right font-medium", summary.netPnl >= 0 ? "text-profit" : "text-loss")}>
                      {formatCurrency(summary.netPnl)}
                    </td>
                    {effectiveTaxPct != null && (
                      <td className="py-2 pr-4 text-right text-text-muted">{formatCurrency(summary.afterTax)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {profiles.some((p) => p.isCustom) && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-text-muted">Your custom brokers</h2>
          <div className="space-y-2">
            {profiles
              .filter((p) => p.isCustom)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="text-text">{p.name}</span>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Delete "${p.name}"?`)) return;
                      startTransition(async () => {
                        await deleteCustomBrokerProfile(p.id);
                        if (profileId === p.id) setProfileId("");
                      });
                    }}
                    disabled={isPending}
                    className="rounded p-1.5 text-text-faint hover:bg-loss-bg hover:text-loss"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileDetail({ profile }: { profile: Profile }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {profile.perContractFeeFutures != null && <span>Futures: {formatCurrency(profile.perContractFeeFutures)}/contract/side</span>}
        {profile.perContractFeeOptions != null && <span>Options: {formatCurrency(profile.perContractFeeOptions)}/contract/side</span>}
        {profile.perShareFeeStock != null && <span>Stock: {formatCurrency(profile.perShareFeeStock)}/share/side</span>}
        {profile.minFeePerOrder != null && <span>Min/order: {formatCurrency(profile.minFeePerOrder)}</span>}
      </div>
      {profile.notes && <p className="mt-1.5">{profile.notes}</p>}
      <div className="mt-1.5 flex items-center gap-3">
        {profile.sourceUrl && (
          <a href={profile.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent hover:underline">
            <ExternalLink className="h-3 w-3" /> Source
          </a>
        )}
        {profile.feesAsOf && <span>As of {formatDate(profile.feesAsOf)}</span>}
      </div>
    </div>
  );
}

const emptyInput: BrokerProfileInput = {
  name: "",
  perContractFeeFutures: null,
  perContractFeeOptions: null,
  perShareFeeStock: null,
  minFeePerOrder: null,
  monthlyPlatformFee: null,
  notes: null,
};

function AddBrokerForm({ onDone, onCreated }: { onDone: () => void; onCreated: (id: string) => void }) {
  const [draft, setDraft] = useState<BrokerProfileInput>(emptyInput);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const numField = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = () => {
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createCustomBrokerProfile(draft);
        onCreated(created.id);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save broker");
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-accent/40 bg-surface p-4">
      {error && <div className="rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">{error}</div>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Broker name"
          className={inputClass}
        />
        <input
          type="number"
          step="any"
          onChange={(e) => setDraft({ ...draft, perContractFeeFutures: numField(e.target.value) })}
          placeholder="Futures $/contract/side"
          className={inputClass}
        />
        <input
          type="number"
          step="any"
          onChange={(e) => setDraft({ ...draft, perContractFeeOptions: numField(e.target.value) })}
          placeholder="Options $/contract/side"
          className={inputClass}
        />
        <input
          type="number"
          step="any"
          onChange={(e) => setDraft({ ...draft, perShareFeeStock: numField(e.target.value) })}
          placeholder="Stock $/share/side"
          className={inputClass}
        />
        <input
          type="number"
          step="any"
          onChange={(e) => setDraft({ ...draft, minFeePerOrder: numField(e.target.value) })}
          placeholder="Min $/order"
          className={inputClass}
        />
        <input
          onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
          placeholder="Notes (optional)"
          className={inputClass}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          Save broker
        </button>
        <button
          onClick={onDone}
          className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent";
