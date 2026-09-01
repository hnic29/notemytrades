"use client";

import { useEffect, useState } from "react";
import { BacktestChart, type ChartTrade } from "./BacktestChart";
import { PlaybackControls } from "./PlaybackControls";
import { formatDateTime } from "@/lib/format";
import type { Candle } from "@/lib/market-data/yahoo";

export function TradeReplay({ candles, trade }: { candles: Candle[]; trade: ChartTrade }) {
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
    <div>
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
  );
}
