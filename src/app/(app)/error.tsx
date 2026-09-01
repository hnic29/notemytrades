"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Catches any error thrown during render or in an event handler
 * anywhere under the (app) route group — including the many action
 * call sites that don't try/catch a rejected server action themselves
 * (deletes, share-link toggles, etc.). Without this, an unexpected
 * failure (e.g. a stale row, a locked SQLite file) would blow up to
 * Next's default full-page crash instead of a recoverable state that
 * keeps the sidebar usable.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-10 w-10 text-loss" />
      <div>
        <h1 className="text-lg font-semibold text-text">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-text hover:bg-surface-2"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
