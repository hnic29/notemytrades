"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Play, RefreshCw, X, XCircle } from "lucide-react";
import {
  launchTradingViewDesktop,
  syncFromTradingView,
  type TradingViewSyncResult,
} from "@/lib/actions/tradingview";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type AccountOption = { id: string; name: string };

/**
 * "Sync from TradingView": one click pulls Paper Trading's fills
 * straight out of the running TradingView Desktop — no export, no
 * files. Opens a small dialog so the account choice and the outcome
 * (what came in, what was already there, anything to double-check)
 * are visible without leaving the page.
 */
export function TradingViewSyncButton({
  accounts,
  variant = "secondary",
  className,
}: {
  accounts: AccountOption[];
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [result, setResult] = useState<TradingViewSyncResult | null>(null);
  const [launchNote, setLaunchNote] = useState<string | null>(null);
  const [isSyncing, startSync] = useTransition();
  const [isLaunching, startLaunch] = useTransition();

  const sync = () => {
    if (!accountId) return;
    setLaunchNote(null);
    startSync(async () => {
      const r = await syncFromTradingView(accountId);
      setResult(r);
      if (r.ok && r.imported > 0) router.refresh();
    });
  };

  const launch = () => {
    setLaunchNote(null);
    startLaunch(async () => {
      const r = await launchTradingViewDesktop();
      if (r.ok) {
        setLaunchNote(
          r.alreadyRunning
            ? "TradingView is reachable. Syncing…"
            : "TradingView is up. Give the chart a moment to load, then it syncs automatically.",
        );
        setResult(null);
        // A fresh instance needs a few seconds before the chart page and
        // its trading API exist; the sync itself reports if it's too soon.
        if (!r.alreadyRunning) await new Promise((res) => setTimeout(res, 8000));
        const s = await syncFromTradingView(accountId);
        setResult(s);
        setLaunchNote(null);
        if (s.ok && s.imported > 0) router.refresh();
      } else {
        setResult(r);
      }
    });
  };

  const close = () => {
    setOpen(false);
    setResult(null);
    setLaunchNote(null);
  };

  const busy = isSyncing || isLaunching;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm",
          variant === "primary"
            ? "bg-accent font-medium text-accent-fg hover:bg-accent-strong"
            : "border border-border-strong text-text hover:bg-surface-2",
          className,
        )}
      >
        <RefreshCw className="h-4 w-4" /> Sync from TradingView
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={busy ? undefined : close} />
          <div
            role="dialog"
            aria-label="Sync from TradingView"
            className="relative w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold text-text">Sync from TradingView</h2>
              <button
                onClick={close}
                disabled={busy}
                aria-label="Close"
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-text-muted">
                Reads every Paper Trading fill from the TradingView Desktop that&apos;s running on
                this PC and adds the trades that aren&apos;t in your journal yet. Nothing to export,
                and nothing is ever imported twice.
              </p>

              {accounts.length > 1 && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-text-muted">Into account</span>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {launchNote && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" /> {launchNote}
                </div>
              )}

              {result && result.ok && <SyncOutcome result={result} />}

              {result && !result.ok && (
                <div className="space-y-3 rounded-md border border-loss/40 bg-loss-bg px-4 py-3 text-sm">
                  <p className="flex items-start gap-2 text-loss">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{result.error}</span>
                  </p>
                  <p className="text-text-muted">{result.hint}</p>
                  {result.code === "unreachable" && (
                    <button
                      type="button"
                      onClick={launch}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-60"
                    >
                      {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      Launch TradingView
                    </button>
                  )}
                  <p className="text-xs text-text-faint">
                    Port and launch help live in{" "}
                    <Link href="/settings" className="text-accent hover:underline">
                      Settings → TradingView
                    </Link>
                    .
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              {result?.ok ? (
                <>
                  <button
                    onClick={close}
                    className="rounded-md border border-border-strong px-3 py-2 text-sm text-text hover:bg-surface-2"
                  >
                    Done
                  </button>
                  <button
                    onClick={sync}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-60"
                  >
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Sync again
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={close}
                    disabled={busy}
                    className="rounded-md border border-border-strong px-3 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sync}
                    disabled={busy || !accountId}
                    className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-60"
                  >
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isSyncing ? "Reading TradingView…" : result ? "Try again" : "Sync now"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SyncOutcome({ result }: { result: Extract<TradingViewSyncResult, { ok: true }> }) {
  const nothingNew = result.imported === 0;
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-md border px-4 py-3",
          nothingNew ? "border-border bg-surface-2" : "border-profit/40 bg-profit-bg",
        )}
      >
        <p className={cn("flex items-center gap-2 text-sm font-medium", nothingNew ? "text-text" : "text-profit")}>
          <CheckCircle2 className="h-4 w-4" />
          {nothingNew
            ? "Up to date — nothing new to import"
            : `Imported ${result.imported} trade${result.imported === 1 ? "" : "s"}`}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {result.account && <>Paper Trading account {result.account} · </>}
          {result.fills} fill{result.fills === 1 ? "" : "s"} → {result.trades} closed trade
          {result.trades === 1 ? "" : "s"}
          {result.duplicates > 0 && <> · {result.duplicates} already in this account</>}
          {!nothingNew && <> · net {formatCurrency(result.netPnl)} across everything paired</>}
        </p>
      </div>

      {result.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-xs text-warning">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {result.errors.length > 0 && (
        <p className="text-xs text-loss">
          {result.errors.length} fill{result.errors.length === 1 ? "" : "s"} couldn&apos;t be read and were
          skipped.
        </p>
      )}
    </div>
  );
}
