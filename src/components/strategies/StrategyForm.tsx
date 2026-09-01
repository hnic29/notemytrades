"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createStrategy, updateStrategy } from "@/lib/actions/strategies";
import type { RuleGroup } from "@/lib/queries/strategies";
import { RulesEditor } from "./RulesEditor";

export function StrategyForm({
  strategyId,
  initialName = "",
  initialDescription = "",
  initialRules = [],
}: {
  strategyId?: string;
  initialName?: string;
  initialDescription?: string;
  initialRules?: RuleGroup[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [rules, setRules] = useState<RuleGroup[]>(initialRules);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name is required");

    startTransition(async () => {
      try {
        const cleanRules = rules
          .map((g) => ({ group: g.group.trim() || "Untitled Group", rules: g.rules.filter((r) => r.trim()) }))
          .filter((g) => g.group);
        const strategy = strategyId
          ? await updateStrategy(strategyId, { name, description, rules: cleanRules })
          : await createStrategy({ name, description, rules: cleanRules });
        router.push(`/strategies/${strategy.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save strategy");
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

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-text-muted">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Opening Range Breakout"
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-text-muted">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </label>

      <div>
        <span className="mb-2 block text-xs font-medium text-text-muted">
          Rules (grouped, e.g. Entry / Exit / Risk)
        </span>
        <RulesEditor groups={rules} onChange={setRules} />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? "Saving…" : strategyId ? "Save Changes" : "Create Strategy"}
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
