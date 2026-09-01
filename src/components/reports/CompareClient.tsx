"use client";

import { useMemo, useState } from "react";
import type { Group } from "@/lib/analytics/grouping";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Dimension = "symbol" | "tag" | "strategy" | "side";

const DIMENSION_LABELS: Record<Dimension, string> = {
  symbol: "Symbol",
  tag: "Tag",
  strategy: "Playbook",
  side: "Side",
};

export function CompareClient({
  groupsByDimension,
}: {
  groupsByDimension: Record<Dimension, Group[]>;
}) {
  const [dimension, setDimension] = useState<Dimension>("symbol");
  const groups = groupsByDimension[dimension];

  const [leftKey, setLeftKey] = useState<string>(groups[0]?.key ?? "");
  const [rightKey, setRightKey] = useState<string>(groups[1]?.key ?? groups[0]?.key ?? "");

  const options = useMemo(() => groupsByDimension[dimension], [groupsByDimension, dimension]);
  const left = options.find((g) => g.key === leftKey) ?? options[0];
  const right = options.find((g) => g.key === rightKey) ?? options[0];

  const changeDimension = (d: Dimension) => {
    setDimension(d);
    const next = groupsByDimension[d];
    setLeftKey(next[0]?.key ?? "");
    setRightKey(next[1]?.key ?? next[0]?.key ?? "");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-muted">Compare by</span>
        {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((d) => (
          <button
            key={d}
            onClick={() => changeDimension(d)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              dimension === d
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border-strong text-text-muted hover:bg-surface-2",
            )}
          >
            {DIMENSION_LABELS[d]}
          </button>
        ))}
      </div>

      {options.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-text-muted">
          Not enough data to compare by {DIMENSION_LABELS[dimension].toLowerCase()} yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CompareCard
            options={options}
            selected={leftKey}
            onSelect={setLeftKey}
            group={left}
          />
          <CompareCard
            options={options}
            selected={rightKey}
            onSelect={setRightKey}
            group={right}
          />
        </div>
      )}
    </div>
  );
}

function CompareCard({
  options,
  selected,
  onSelect,
  group,
}: {
  options: Group[];
  selected: string;
  onSelect: (key: string) => void;
  group: Group | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="mb-4 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>

      {group && (
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Net P&L"
            value={formatCurrency(group.stats.netPnl)}
            tone={group.stats.netPnl >= 0 ? "profit" : "loss"}
          />
          <Stat
            label="Win Rate"
            value={group.stats.winRate != null ? formatPercent(group.stats.winRate) : "—"}
          />
          <Stat label="Trades" value={String(group.stats.closedTrades)} />
          <Stat
            label="Profit Factor"
            value={group.stats.profitFactor != null ? group.stats.profitFactor.toFixed(2) : "—"}
          />
          <Stat label="Avg Win" value={formatCurrency(group.stats.avgWin)} tone="profit" />
          <Stat label="Avg Loss" value={formatCurrency(-group.stats.avgLoss)} tone="loss" />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div>
      <div className="text-xs text-text-faint">{label}</div>
      <div
        className={cn(
          "text-lg font-semibold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          !tone && "text-text",
        )}
      >
        {value}
      </div>
    </div>
  );
}
