"use client";

import { Plus, Trash2 } from "lucide-react";
import type { RuleGroup } from "@/lib/queries/strategies";

export function RulesEditor({
  groups,
  onChange,
}: {
  groups: RuleGroup[];
  onChange: (groups: RuleGroup[]) => void;
}) {
  const addGroup = () => onChange([...groups, { group: "New Group", rules: [] }]);

  const updateGroupName = (i: number, name: string) => {
    const next = [...groups];
    next[i] = { ...next[i], group: name };
    onChange(next);
  };

  const removeGroup = (i: number) => onChange(groups.filter((_, idx) => idx !== i));

  const addRule = (i: number) => {
    const next = [...groups];
    next[i] = { ...next[i], rules: [...next[i].rules, ""] };
    onChange(next);
  };

  const updateRule = (i: number, r: number, value: string) => {
    const next = [...groups];
    const rules = [...next[i].rules];
    rules[r] = value;
    next[i] = { ...next[i], rules };
    onChange(next);
  };

  const removeRule = (i: number, r: number) => {
    const next = [...groups];
    next[i] = { ...next[i], rules: next[i].rules.filter((_, idx) => idx !== r) };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {groups.map((g, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              value={g.group}
              onChange={(e) => updateGroupName(i, e.target.value)}
              className="flex-1 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-text outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => removeGroup(i)}
              className="rounded p-1.5 text-text-faint hover:bg-loss-bg hover:text-loss"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 pl-1">
            {g.rules.map((rule, r) => (
              <div key={r} className="flex items-center gap-2">
                <input
                  value={rule}
                  onChange={(e) => updateRule(i, r, e.target.value)}
                  placeholder="e.g. Price above 20 EMA"
                  className="flex-1 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => removeRule(i, r)}
                  className="rounded p-1 text-text-faint hover:text-loss"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addRule(i)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-faint hover:text-accent"
            >
              <Plus className="h-3 w-3" /> Add rule
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addGroup}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-border-strong px-3 py-2 text-sm text-text-muted hover:border-accent/50 hover:text-accent"
      >
        <Plus className="h-4 w-4" /> Add Group
      </button>
    </div>
  );
}
