"use client";

import { useState } from "react";
import Link from "next/link";
import { ASSET_CLASS_LABELS, STRATEGY_TEMPLATES, type AssetClass } from "@/lib/strategies/templates";
import { cn } from "@/lib/utils";

const FILTERS: (AssetClass | "all")[] = ["all", "stock", "option", "futures", "forex", "crypto", "mixed"];

export default function StrategyTemplatesPage() {
  const [filter, setFilter] = useState<AssetClass | "all">("all");
  const templates =
    filter === "all" ? STRATEGY_TEMPLATES : STRATEGY_TEMPLATES.filter((t) => t.assetType === filter);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-text-faint">
        <Link href="/strategies" className="hover:text-text">
          Strategies
        </Link>
        <span>/</span>
        <span>Templates</span>
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-text">Strategy Templates</h1>
      <p className="mb-6 max-w-xl text-sm text-text-muted">
        No blank page — pick a template, tweak the details, and save it as your own playbook.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              filter === f
                ? "border-accent bg-accent/10 text-accent"
                : "border-border-strong text-text-muted hover:border-accent/50",
            )}
          >
            {f === "all" ? "All" : ASSET_CLASS_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.slug} className="flex flex-col rounded-lg border border-border bg-surface p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="font-medium text-text">{t.name}</h2>
              <span className="shrink-0 rounded-full border border-border-strong px-2 py-0.5 text-xs text-text-faint">
                {ASSET_CLASS_LABELS[t.assetType]}
              </span>
            </div>
            <p className="mb-4 flex-1 text-sm text-text-muted">{t.description}</p>
            <Link
              href={`/strategies/new?template=${t.slug}`}
              className="rounded-md bg-accent px-3 py-2 text-center text-sm font-medium text-accent-fg hover:bg-accent-strong"
            >
              Use Template
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
