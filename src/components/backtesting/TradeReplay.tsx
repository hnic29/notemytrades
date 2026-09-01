"use client";

import { useEffect, useState } from "react";
import { BacktestChart, type ChartTrade } from "./BacktestChart";
import { PlaybackControls } from "./PlaybackControls";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Candle } from "@/lib/market-data/yahoo";

export type ReplayExecution = {
  id: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: Date;
};

export type ReplayTrade = ChartTrade & {
  symbol: string;
  quantity: number;
  netPnl: number;
  netRoi: number | null;
  executions: ReplayExecution[];
};

export function TradeReplay({ candles, trade }: { candles: Candle[]; trade: ReplayTrade }) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(10, candles.length));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    if (visibleCount >= candles.length) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setVisibleCount((c) => Math.min(c + 1, candles.length)), 400 / speed);
    return () => clearTimeout(id);
  }, [playing, speed, visibleCount, candles.length]);

  const visibleCandles = candles.slice(0, visibleCount);
  const currentCandle = visibleCandles[visibleCandles.length - 1] ?? null;

  // Only reveal the trade's entry/exit markers once the replay has
  // actually reached that point in time, not immediately.
  const revealedTrade: ChartTrade = {
    ...trade,
    closedAt:
      trade.closedAt && currentCandle && currentCandle.time * 1000 >= trade.closedAt.getTime()
        ? trade.closedAt
        : null,
  };
  const showEntry = currentCandle && currentCandle.time * 1000 >= trade.openedAt.getTime();

  if (candles.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-text-faint">
        No chart data available to replay this trade — it may be outside Yahoo Finance&apos;s
        free intraday history window.
      </p>
    );
  }

  return (
    <div className="lg:flex lg:items-start lg:gap-4">
      <div className="lg:min-w-0 lg:flex-1">
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <BacktestChart candles={visibleCandles} trades={showEntry ? [revealedTrade] : []} />
        </div>
        <PlaybackControls
          playing={playing}
          onTogglePlay={() => setPlaying((p) => !p)}
          onStepBack={() => setVisibleCount((c) => Math.max(2, c - 1))}
          onStepForward={() => setVisibleCount((c) => Math.min(candles.length, c + 1))}
          onJumpStart={() => setVisibleCount(Math.min(10, candles.length))}
          onJumpEnd={() => setVisibleCount(candles.length)}
          speed={speed}
          onSpeedChange={setSpeed}
          progressLabel={`${visibleCount} / ${candles.length} candles${
            currentCandle ? ` · ${formatDateTime(new Date(currentCandle.time * 1000))}` : ""
          }`}
        />
      </div>

      <div className="mt-4 space-y-4 lg:mt-0 lg:w-72 lg:shrink-0">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-text-muted">Trade Stats</h2>
          <dl className="space-y-2 text-sm">
            <StatRow label="Symbol" value={trade.symbol} />
            <StatRow label="Side" value={trade.side} capitalize />
            <StatRow label="Quantity" value={String(trade.quantity)} />
            <StatRow label="Entry" value={formatCurrency(trade.avgEntryPrice)} />
            <StatRow
              label="Exit"
              value={trade.avgExitPrice != null ? formatCurrency(trade.avgExitPrice) : "open"}
            />
            <StatRow
              label="Net P&L"
              value={formatCurrency(trade.netPnl)}
              tone={trade.netPnl >= 0 ? "profit" : "loss"}
            />
            <StatRow
              label="Net ROI"
              value={trade.netRoi != null ? formatPercent(trade.netRoi) : "—"}
              tone={trade.netRoi != null ? (trade.netRoi >= 0 ? "profit" : "loss") : undefined}
            />
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-medium text-text-muted">
            Executions ({trade.executions.length})
          </h2>
          {trade.executions.length === 0 ? (
            <p className="text-sm text-text-faint">No execution records.</p>
          ) : (
            <ul className="space-y-2">
              {trade.executions.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-medium capitalize",
                      e.side === "buy" ? "bg-profit-bg text-profit" : "bg-loss-bg text-loss",
                    )}
                  >
                    {e.side}
                  </span>
                  <span className="text-text-muted">{e.quantity} @ {formatCurrency(e.price)}</span>
                  <span className="text-text-faint">{formatDateTime(e.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  tone,
  capitalize,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-faint">{label}</dt>
      <dd
        className={cn(
          "font-medium",
          capitalize && "capitalize",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          !tone && "text-text",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
