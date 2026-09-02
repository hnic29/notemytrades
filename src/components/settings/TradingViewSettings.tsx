"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import {
  checkTradingView,
  launchTradingViewDesktop,
  updateTradingViewPort,
  type TradingViewStatus,
} from "@/lib/actions/tradingview";

const inputClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none";

export function TradingViewSettings({ initialPort }: { initialPort: number }) {
  const [port, setPort] = useState(String(initialPort));
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<TradingViewStatus | null>(null);
  const [launchNote, setLaunchNote] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isChecking, startChecking] = useTransition();
  const [isLaunching, startLaunching] = useTransition();

  const busy = isSaving || isChecking || isLaunching;

  const save = async () => {
    await updateTradingViewPort(Number(port));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const check = () => {
    startChecking(async () => {
      await save();
      setLaunchNote(null);
      setStatus(await checkTradingView());
    });
  };

  const launch = () => {
    startLaunching(async () => {
      await save();
      setStatus(null);
      setLaunchNote("Starting TradingView…");
      const r = await launchTradingViewDesktop();
      if (!r.ok) {
        setLaunchNote(null);
        setStatus(r);
        return;
      }
      setLaunchNote(r.alreadyRunning ? "Already running with remote debugging on." : "TradingView is up — waiting for the chart to load…");
      if (!r.alreadyRunning) await new Promise((res) => setTimeout(res, 8000));
      setStatus(await checkTradingView());
      setLaunchNote(null);
    });
  };

  return (
    <div data-testid="tradingview-sync-section" className="max-w-xl space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-text">Remote debugging port</span>
        <input
          value={port}
          onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="9222"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-text-faint">
          TradingView Desktop must be started with{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-text-muted">--remote-debugging-port={port || "9222"}</code>{" "}
          for the sync to reach it. The Launch button does that for you; the port only matters if
          something else already uses 9222.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => startSaving(save)}
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-60"
        >
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={check}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-60"
        >
          {isChecking && <Loader2 className="h-4 w-4 animate-spin" />}
          Test connection
        </button>
        <button
          type="button"
          onClick={launch}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-60"
        >
          {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Launch TradingView
        </button>
      </div>

      {launchNote && (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" /> {launchNote}
        </p>
      )}

      {status && status.ok && (
        <div className="rounded-md border border-profit/40 bg-profit-bg px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-profit">
            <CheckCircle2 className="h-4 w-4" /> Connected to {status.broker}
            {status.account && <> · account {status.account}</>}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {status.fills} fill{status.fills === 1 ? "" : "s"} on record · {status.openPositions} open position
            {status.openPositions === 1 ? "" : "s"} ·{" "}
            {status.verified ? "balance history available for P&L verification" : "balance history not exposed — P&L won't be cross-checked"}
          </p>
        </div>
      )}

      {status && !status.ok && (
        <div className="rounded-md border border-loss/40 bg-loss-bg px-4 py-3 text-sm">
          <p className="flex items-start gap-2 text-loss">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{status.error}</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">{status.hint}</p>
        </div>
      )}
    </div>
  );
}
