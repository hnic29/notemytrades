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

export type OrderType = "market" | "limit" | "stop";

export type OpenOrderInput = {
  side: "long" | "short";
  quantity: number;
  stopLoss: number | null;
  profitTarget: number | null;
  autoBreakevenR: number | null;
};

export type PlacePendingOrderInput = OpenOrderInput & {
  orderType: "limit" | "stop";
  triggerPrice: number;
};

export function TradeControls({
  currentCandle,
  openTrade,
  currentBalance,
  onOpen,
  onPlaceOrder,
  onClose,
}: {
  currentCandle: Candle | null;
  openTrade: OpenTrade | null;
  /** Account starting balance plus realized P&L so far — used to size
   * quantity from a risk-% preset. Falls back to disabling the presets
   * (rather than sizing off $0) when no account balance is known. */
  currentBalance: number;
  /** Market orders — fills instantly at the current candle's close. */
  onOpen: (input: OpenOrderInput) => Promise<void>;
  /** Limit/stop orders — sits pending until a later candle triggers it. */
  onPlaceOrder: (input: PlacePendingOrderInput) => Promise<void>;
  onClose: () => Promise<void>;
}) {
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [stopLoss, setStopLoss] = useState("");
  const [profitTarget, setProfitTarget] = useState("");
  const [autoBreakevenR, setAutoBreakevenR] = useState("");
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
          <div className="flex gap-1.5">
            {(["market", "limit", "stop"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1 text-xs capitalize",
                  orderType === t
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-strong text-text-muted hover:border-accent/50",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className={cn("grid gap-2", orderType === "market" ? "grid-cols-3" : "grid-cols-4")}>
            {orderType !== "market" && (
              <input
                type="number"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                placeholder={orderType === "limit" ? "Limit px" : "Stop px"}
                className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
              />
            )}
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

          <input
            type="number"
            value={autoBreakevenR}
            onChange={(e) => setAutoBreakevenR(e.target.value)}
            placeholder="Auto-breakeven at __R (optional, needs a stop)"
            title="Move the stop to entry once unrealized profit reaches this R-multiple"
            className="w-full rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          />

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
              disabled={isPending || quantity <= 0 || (orderType !== "market" && !triggerPrice)}
              onClick={() => startTransition(() => submit("long"))}
              className="rounded-md bg-profit px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {orderType === "market" ? "Buy / Long" : "Place Long Order"}
            </button>
            <button
              disabled={isPending || quantity <= 0 || (orderType !== "market" && !triggerPrice)}
              onClick={() => startTransition(() => submit("short"))}
              className="rounded-md bg-loss px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {orderType === "market" ? "Sell / Short" : "Place Short Order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function submit(side: "long" | "short") {
    const base = {
      side,
      quantity,
      stopLoss: stopLoss === "" ? null : Number(stopLoss),
      profitTarget: profitTarget === "" ? null : Number(profitTarget),
      autoBreakevenR: autoBreakevenR === "" ? null : Number(autoBreakevenR),
    };
    if (orderType === "market") return onOpen(base);
    return onPlaceOrder({ ...base, orderType, triggerPrice: Number(triggerPrice) });
  }
}
