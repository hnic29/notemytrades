"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { generateBacktestSummary } from "@/lib/actions/ai";

export function BacktestSummary({ sessionId }: { sessionId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-text-muted">
          <Sparkles className="h-3.5 w-3.5" /> AI Summary
        </h2>
        <button
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await generateBacktestSummary(sessionId);
              if (result.ok) setSummary(result.text);
              else setError(result.error);
            })
          }
          disabled={isPending}
          className="rounded-md border border-border-strong px-2.5 py-1 text-xs text-text-muted hover:bg-surface-2 disabled:opacity-50"
        >
          {isPending ? "Thinking…" : summary ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      {summary && !error && <p className="text-sm text-text">{summary}</p>}
    </div>
  );
}
