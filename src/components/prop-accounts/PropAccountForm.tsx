"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPropAccount, updatePropAccount, type PropAccountInput } from "@/lib/actions/prop-accounts";

const CHALLENGE_TYPES = ["1-step", "2-step", "instant", "funded"];
const PHASES = [
  { value: "challenge", label: "Challenge" },
  { value: "verification", label: "Verification" },
  { value: "funded", label: "Funded" },
];

export function PropAccountForm({
  propAccountId,
  initial,
}: {
  propAccountId?: string;
  initial?: PropAccountInput;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PropAccountInput>(
    initial ?? {
      accountName: "",
      firmName: "",
      challengeType: "2-step",
      phase: "challenge",
      accountSize: 50000,
      profitTarget: null,
      maxDailyLoss: null,
      maxTotalDrawdown: null,
      startDate: new Date().toISOString().slice(0, 10),
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof PropAccountInput>(key: K, value: PropAccountInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!values.accountName.trim()) return setError("Account name is required");
    if (!values.firmName.trim()) return setError("Firm name is required");

    startTransition(async () => {
      try {
        const result = propAccountId
          ? await updatePropAccount(propAccountId, values)
          : await createPropAccount(values);
        router.push(`/prop-accounts/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Account Name">
          <input
            value={values.accountName}
            onChange={(e) => set("accountName", e.target.value)}
            placeholder="FTMO 100k #1"
            className={inputClass}
          />
        </Field>
        <Field label="Firm Name">
          <input
            value={values.firmName}
            onChange={(e) => set("firmName", e.target.value)}
            placeholder="FTMO"
            className={inputClass}
          />
        </Field>
        <Field label="Challenge Type">
          <select
            value={values.challengeType}
            onChange={(e) => set("challengeType", e.target.value)}
            className={inputClass}
          >
            {CHALLENGE_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phase">
          <select
            value={values.phase}
            onChange={(e) => set("phase", e.target.value)}
            className={inputClass}
          >
            {PHASES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account Size">
          <input
            type="number"
            step="any"
            value={values.accountSize}
            onChange={(e) => set("accountSize", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Start Date">
          <input
            type="date"
            value={values.startDate ?? ""}
            onChange={(e) => set("startDate", e.target.value || null)}
            className={inputClass}
          />
        </Field>
        <Field label="Profit Target ($)">
          <input
            type="number"
            step="any"
            value={values.profitTarget ?? ""}
            onChange={(e) => set("profitTarget", e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Max Daily Loss ($)">
          <input
            type="number"
            step="any"
            value={values.maxDailyLoss ?? ""}
            onChange={(e) => set("maxDailyLoss", e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Max Total Drawdown ($)">
          <input
            type="number"
            step="any"
            value={values.maxTotalDrawdown ?? ""}
            onChange={(e) =>
              set("maxTotalDrawdown", e.target.value === "" ? null : Number(e.target.value))
            }
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
          {isPending ? "Saving…" : propAccountId ? "Save Changes" : "Create Prop Account"}
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
