"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { createRule, deleteRule, resetRuleHistory, toggleRuleActive } from "@/lib/actions/progress";
import { cn } from "@/lib/utils";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  active: boolean;
};

export function RuleManager({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "perTrade">("daily");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      await createRule({ name, description, frequency });
      setName("");
      setDescription("");
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-3 space-y-2">
        {rules.length === 0 && (
          <p className="text-sm text-text-faint">No rules yet. Add one to start tracking.</p>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium", r.active ? "text-text" : "text-text-faint line-through")}>
                  {r.name}
                </span>
                <span className="rounded-full border border-border-strong px-1.5 py-0.5 text-[10px] text-text-faint">
                  {r.frequency === "daily" ? "Daily" : "Per Trade"}
                </span>
              </div>
              {r.description && <p className="mt-0.5 text-xs text-text-muted">{r.description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <label className="mr-2 flex items-center gap-1.5 text-xs text-text-faint">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={(e) =>
                    startTransition(async () => {
                      await toggleRuleActive(r.id, e.target.checked);
                      router.refresh();
                    })
                  }
                  className="accent-accent"
                />
                Active
              </label>
              <button
                title="Reset history"
                onClick={() => {
                  if (!window.confirm(`Reset all tracked history for "${r.name}"?`)) return;
                  startTransition(async () => {
                    await resetRuleHistory(r.id);
                    router.refresh();
                  });
                }}
                className="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-text"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                title="Delete rule"
                onClick={() => {
                  if (!window.confirm(`Delete "${r.name}"? This also clears its history.`)) return;
                  startTransition(async () => {
                    await deleteRule(r.id);
                    router.refresh();
                  });
                }}
                className="rounded p-1.5 text-text-faint hover:bg-loss-bg hover:text-loss"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="space-y-2 rounded-md border border-border bg-surface p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rule name, e.g. Risked ≤1% per trade"
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            {(["daily", "perTrade"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-1.5 text-sm",
                  frequency === f
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border-strong text-text-muted hover:bg-surface-2",
                )}
              >
                {f === "daily" ? "Check daily" : "Check per trade"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
            >
              Add Rule
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
          <Plus className="h-3.5 w-3.5" /> Add a rule
        </button>
      )}
    </div>
  );
}
