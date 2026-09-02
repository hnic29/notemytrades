"use client";

import { useState, useTransition } from "react";
import { parseBacktestRule } from "@/lib/actions/ai";
import { runAutoBacktest } from "@/lib/actions/backtesting";
import type { BacktestRule } from "@/lib/backtesting/rule-schema";

const COMPARISON_LABEL: Record<BacktestRule["entry"]["comparison"], string> = {
  crosses_above: "crosses above",
  crosses_below: "crosses below",
  greater_than: "is greater than",
  less_than: "is less than",
};

function describeRef(ref: { type: string; period?: number }): string {
  return ref.type === "price" ? "price" : `${ref.type.toUpperCase()}(${ref.period})`;
}

/** Renders the parsed rule back in plain English so the user reviews
 * what the AI decided before anything runs — never executes AI output
 * the user hasn't seen. */
function describeRule(rule: BacktestRule): string {
  const left = describeRef(rule.entry.left);
  const right = rule.entry.right.type === "value" ? String(rule.entry.right.value) : describeRef(rule.entry.right);

  const exitParts: string[] = [];
  if (rule.exit.takeProfitPct != null) exitParts.push(`+${rule.exit.takeProfitPct}% target`);
  if (rule.exit.stopLossPct != null) exitParts.push(`-${rule.exit.stopLossPct}% stop`);

  const sizing =
    rule.positionSizing.type === "fixedQuantity"
      ? `${rule.positionSizing.quantity} units per trade`
      : `${rule.positionSizing.percent}% risk sizing`;

  return `Go ${rule.side} when ${left} ${COMPARISON_LABEL[rule.entry.comparison]} ${right}. Exit at ${exitParts.join(" or ")}. Size by ${sizing}.`;
}

export function BacktestRuleBuilder({
  sessionId,
  accountId,
  assetType,
  onRan,
}: {
  sessionId: string;
  accountId: string;
  assetType: string;
  onRan: () => void;
}) {
  const [description, setDescription] = useState("");
  const [rule, setRule] = useState<BacktestRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isParsing, startParsing] = useTransition();
  const [isRunning, startRunning] = useTransition();

  const handleGenerate = () => {
    setError(null);
    setRule(null);
    setResult(null);
    startParsing(async () => {
      const res = await parseBacktestRule(description);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRule(res.rule);
    });
  };

  const handleRun = () => {
    if (!rule) return;
    setError(null);
    startRunning(async () => {
      try {
        const res = await runAutoBacktest(sessionId, accountId, assetType, rule);
        setResult(`Created ${res.tradesCreated} trade${res.tradesCreated === 1 ? "" : "s"}.`);
        setRule(null);
        onRan();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to run auto-backtest");
      }
    });
  };

  return (
    <div data-testid="ai-auto-backtest-panel" className="mb-6 rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-medium text-text-muted">AI Auto-Backtest</h3>
      <p className="mb-3 text-xs text-text-faint">
        Describe a simple rule — one entry condition, a %-based stop/target — and it runs
        deterministically across every candle in this session. Not for multi-condition strategies,
        indicator-based exits, or chart-pattern reasoning.
      </p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Buy when price closes above the 20 EMA, exit at 1% profit or -0.5% loss, risk 1% per trade."
        rows={3}
        className="mb-2 w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />
      <button
        type="button"
        disabled={isParsing || !description.trim()}
        onClick={handleGenerate}
        className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
      >
        {isParsing ? "Parsing…" : "Generate Rule"}
      </button>

      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
      {result && <p className="mt-2 text-sm text-profit">{result}</p>}

      {rule && (
        <div className="mt-3 rounded-md bg-surface-2 p-3">
          <p className="mb-2 text-sm text-text">{describeRule(rule)}</p>
          <button
            type="button"
            disabled={isRunning}
            onClick={handleRun}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
          >
            {isRunning ? "Running…" : "Run Backtest"}
          </button>
        </div>
      )}
    </div>
  );
}
