"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { RuleGroup } from "@/lib/queries/strategies";

function storageKey(strategyId: string) {
  return `nmt.strategy.${strategyId}.checkedRules`;
}

function ruleKey(groupIndex: number, ruleIndex: number) {
  return `${groupIndex}:${ruleIndex}`;
}

/** Interactive rule checklist with a "X/Y rules followed" progress bar.
 * Checked state is per-viewer (localStorage) rather than a DB model —
 * there's no per-trade rule-adherence tracking here, this is just a
 * lightweight "did I follow my own playbook today" scratchpad. */
export function RulesChecklist({
  strategyId,
  groups,
}: {
  strategyId: string;
  groups: RuleGroup[];
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Standard hydration-safe mount flag, paired with the localStorage
    // read right below it (also unsafe to run during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(storageKey(strategyId));
      if (raw) setChecked(new Set(JSON.parse(raw)));
    } catch {
      // ignore malformed storage
    }
  }, [strategyId]);

  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
    window.localStorage.setItem(storageKey(strategyId), JSON.stringify(Array.from(next)));
  };

  if (groups.length === 0) {
    return <p className="text-sm text-text-faint">No rules defined for this strategy yet.</p>;
  }

  const totalRules = groups.reduce((sum, g) => sum + g.rules.length, 0);
  const checkedCount = mounted ? checked.size : 0;
  const pct = totalRules > 0 ? Math.min(1, checkedCount / totalRules) : 0;

  return (
    <div className="space-y-4">
      {totalRules > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-text-muted">
            <span>Rules followed</span>
            <span>
              {checkedCount}/{totalRules}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
      )}

      {groups.map((g, i) => (
        <div key={i}>
          <h3 className="mb-1.5 text-sm font-medium text-text">{g.group}</h3>
          <ul className="space-y-1 pl-1">
            {g.rules.map((rule, r) => {
              const key = ruleKey(i, r);
              const isChecked = mounted && checked.has(key);
              return (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        isChecked
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-border-strong text-transparent",
                      )}
                    >
                      ✓
                    </span>
                    <span className={cn(isChecked ? "text-text-faint line-through" : "text-text-muted")}>
                      {rule}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
