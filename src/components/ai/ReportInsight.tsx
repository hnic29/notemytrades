"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { generateReportInsight } from "@/lib/actions/ai";
import { parseFilters } from "@/lib/filters";

export function ReportInsight() {
  const searchParams = useSearchParams();
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    const filters = parseFilters(Object.fromEntries(searchParams.entries()));
    startTransition(async () => {
      const result = await generateReportInsight(filters);
      if (result.ok) setInsight(result.text);
      else setError(result.error);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-text-muted">
          <Sparkles className="h-3.5 w-3.5" /> AI Insight
        </h2>
        <button
          onClick={generate}
          disabled={isPending}
          className="rounded-md border border-border-strong px-2.5 py-1 text-xs text-text-muted hover:bg-surface-2 disabled:opacity-50"
        >
          {isPending ? "Thinking…" : insight ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      {insight && !error && <p className="text-sm text-text">{insight}</p>}
      {!insight && !error && !isPending && (
        <p className="text-sm text-text-faint">
          Get a quick AI-generated read on the numbers for your current filters.
        </p>
      )}
    </div>
  );
}
