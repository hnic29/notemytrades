"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Candle } from "@/lib/market-data/yahoo";

type OpenTrade = {
  id: string;
  side: string;
  quantity: number;
  avgEntryPrice: number;
};

const RISK_PRESETS = [0.5, 1, 2, 3, 5];

export function TradeControls({
  currentCandle,
  openTrade,
  currentBalance,
  onOpen,
  onClose,
}: {
  currentCandle: Candle | null;
  openTrade: OpenTrade | null;
  /** Account starting balance plus realized P&L so far — used to size
   * quantity from a risk-% preset. Falls back to disabling the presets
   * (rather than sizing off $0) when no account balance is known. */
  currentBalance: number;
  onOpen: (input: {
    side: "long" | "short";
    quantity: number;
    stopLoss: number | null;
    profitTarget: number | null;
  }) => Promise<void>;
  onClose: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(100);
  const [stopLoss, setStopLoss] = useState("");
  const [profitTarget, setProfitTarget] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!currentCandle) {
    return <p className="text-sm text-text-faint">No candle loaded yet.</p>;
  }

  const entry = currentCandle.close;
  const stopNum = stopLoss === "" ? null : Number(stopLoss);
  const targetNum = profitTarget === "" ? null : Number(profitTarget);
  const riskPerShare = stopNum != null ? Math.abs(entry - stopNum) : null;
  const rewardPerShare = targetNum != null ? Math.abs(targetNum - entry) : null;
  const riskRewardRatio =
    riskPerShare != null && riskPerShare > 0 && rewardPerShare != null
      ? rewardPerShare / riskPerShare
      : null;
  const liveRiskDollars = riskPerShare != null ? riskPerShare * quantity : null;

  const applyRiskPreset = (pct: number) => {
    if (riskPerShare == null || riskPerShare <= 0 || currentBalance <= 0) return;
    const riskDollars = currentBalance * (pct / 100);
    const nextQty = Math.max(1, Math.floor(riskDollars / riskPerShare));
    setQuantity(nextQty);
  };

  const unrealized = openTrade
    ? (currentCandle.close - openTrade.avgEntryPrice) *
      openTrade.quantity *
      (openTrade.side === "long" ? 1 : -1)
    : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-text-muted">Current price</span>
        <span className="text-lg font-semibold text-text">
          {formatCurrency(currentCandle.close)}
        </span>
      </div>

      {openTrade ? (
        <div>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="capitalize text-text-muted">
              {openTrade.side} {openTrade.quantity} @ {formatCurrency(openTrade.avgEntryPrice)}
            </span>
            <span className={cn("font-medium", (unrealized ?? 0) >= 0 ? "text-profit" : "text-loss")}>
              {formatCurrency(unrealized ?? 0)} unrealized
            </span>
          </div>
          <button
            disabled={isPending}
            onClick={() => startTransition(onClose)}
            className="w-full rounded-md bg-loss px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Close Position
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              placeholder="Qty"
              className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="Stop"
              className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
            <input
              type="number"
              value={profitTarget}
              onChange={(e) => setProfitTarget(e.target.value)}
              placeholder="Target"
              className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-text-faint">Risk sizing:</span>
            {RISK_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={riskPerShare == null || riskPerShare <= 0 || currentBalance <= 0}
                onClick={() => applyRiskPreset(pct)}
                title={
                  riskPerShare == null
                    ? "Set a stop first"
                    : `Size quantity to risk ${pct}% of ${formatCurrency(currentBalance)}`
                }
                className="rounded-md border border-border-strong px-2 py-1 text-xs text-text-muted hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pct}%
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-md bg-surface-2 px-2.5 py-1.5 text-xs">
            <span className="text-text-faint">
              Risk: {liveRiskDollars != null ? formatCurrency(liveRiskDollars) : "—"}
            </span>
            <span className="text-text-faint">
              R:R {riskRewardRatio != null ? `1 : ${riskRewardRatio.toFixed(2)}` : "—"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isPending || quantity <= 0}
              onClick={() =>
                startTransition(() =>
                  onOpen({
                    side: "long",
                    quantity,
                    stopLoss: stopLoss === "" ? null : Number(stopLoss),
                    profitTarget: profitTarget === "" ? null : Number(profitTarget),
                  }),
                )
              }
              className="rounded-md bg-profit px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Buy / Long
            </button>
            <button
              disabled={isPending || quantity <= 0}
              onClick={() =>
                startTransition(() =>
                  onOpen({
                    side: "short",
                    quantity,
                    stopLoss: stopLoss === "" ? null : Number(stopLoss),
                    profitTarget: profitTarget === "" ? null : Number(profitTarget),
                  }),
                )
              }
              className="rounded-md bg-loss px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Sell / Short
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
