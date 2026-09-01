"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, AlertTriangle } from "lucide-react";
import { resetAllTradingData } from "@/lib/actions/settings";

const CONFIRM_PHRASE = "DELETE";

export function DataManager() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleReset = () => {
    setError(null);
    startTransition(async () => {
      const result = await resetAllTradingData();
      if (result.ok) {
        setConfirmOpen(false);
        setConfirmText("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <div>
          <div className="text-sm font-medium text-text">Export all data</div>
          <div className="text-xs text-text-faint">
            Downloads every trade, note, strategy, and account as one JSON file. Doesn&apos;t
            include your AI API key.
          </div>
        </div>
        <a
          href="/api/export"
          download
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm text-text hover:bg-surface-2"
        >
          <Download className="h-3.5 w-3.5" /> Export JSON
        </a>
      </div>

      <div className="rounded-lg border border-loss/40 bg-loss-bg p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-loss" />
          <div>
            <div className="text-sm font-medium text-loss">Reset all trading data</div>
            <div className="text-xs text-text-muted">
              Permanently deletes every account, trade, note, strategy, prop account, and
              backtesting session. Your AI/API settings are kept. This can&apos;t be undone —
              export a backup first.
            </div>
          </div>
        </div>

        {!confirmOpen ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="mt-3 rounded-md border border-loss/40 px-3 py-1.5 text-sm text-loss hover:bg-loss/10"
          >
            Reset all data…
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-text-muted">
              Type <span className="font-mono font-semibold text-loss">{CONFIRM_PHRASE}</span> to
              confirm:
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-md border border-loss/40 bg-surface px-3 py-2 text-sm text-text outline-none focus:border-loss"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={confirmText !== CONFIRM_PHRASE || isPending}
                className="rounded-md bg-loss px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "Deleting…" : "Permanently delete everything"}
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={isPending}
                className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-loss">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
