"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Columns2 } from "lucide-react";
import { BacktestChart, type ChartTrade } from "./BacktestChart";
import { PlaybackControls } from "./PlaybackControls";
import { getContextCandles } from "@/lib/actions/backtesting";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TIMEFRAME_OPTIONS, type Candle, type Timeframe } from "@/lib/market-data/yahoo";

export type ReplayExecution = {
  id: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: Date;
};

export type ReplayTrade = ChartTrade & {
  symbol: string;
  assetType: string;
  quantity: number;
  netPnl: number;
  netRoi: number | null;
  executions: ReplayExecution[];
};

const SECOND_CHART_ASSET_TYPES = ["stock", "crypto", "forex", "futures"] as const;

export function TradeReplay({
  candles,
  trade,
  windowStart,
  windowEnd,
}: {
  candles: Candle[];
  trade: ReplayTrade;
  /** ISO bounds of the same replay window the primary chart was fetched
   * for — reused so a second chart covers the same stretch of time. */
  windowStart: string;
  windowEnd: string;
}) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(10, candles.length));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const [showSecondChart, setShowSecondChart] = useState(false);
  const [secondSymbol, setSecondSymbol] = useState(trade.symbol);
  const [secondAssetType, setSecondAssetType] = useState<(typeof SECOND_CHART_ASSET_TYPES)[number]>(
    (SECOND_CHART_ASSET_TYPES as readonly string[]).includes(trade.assetType)
      ? (trade.assetType as (typeof SECOND_CHART_ASSET_TYPES)[number])
      : "stock",
  );
  const [secondTimeframe, setSecondTimeframe] = useState<Timeframe>("5m");
  const [secondCandles, setSecondCandles] = useState<Candle[]>([]);
  const [secondError, setSecondError] = useState<string | null>(null);
  // Distinct from "candles.length === 0" — that's also true before the
  // first load ever runs. Gates whether the second BacktestChart mounts
  // at all: rendering one immediately (empty) and then swapping it for a
  // second, data-filled instance a moment later means two lightweight-
  // charts create/destroy cycles back to back, which is exactly the
  // rapid churn that trips the library's internal resize-vs-disposal race.
  const [hasLoadedSecond, setHasLoadedSecond] = useState(false);
  const [isLoadingSecond, startLoadingSecond] = useTransition();

  const loadSecondChart = () => {
    if (!secondSymbol.trim()) return;
    setSecondError(null);
    startLoadingSecond(async () => {
      const result = await getContextCandles(secondSymbol, secondAssetType, secondTimeframe, windowStart, windowEnd);
      if (result.length === 0) setSecondError(`No ${secondTimeframe} data for ${secondSymbol.toUpperCase()} in this window.`);
      setSecondCandles(result);
      setHasLoadedSecond(true);
    });
  };

  useEffect(() => {
    if (!playing) return;
    if (visibleCount >= candles.length) {
      // Correcting playing->false once playback reaches the end is the
      // external-timer/state-machine case set-state-in-effect exists to
      // flag false positives on — there's no event to hang this off of.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setVisibleCount((c) => Math.min(c + 1, candles.length)), 400 / speed);
    return () => clearTimeout(id);
  }, [playing, speed, visibleCount, candles.length]);

  // Memoized so BacktestChart's props stay referentially stable across
  // renders that don't actually change chart content (e.g. typing in the
  // second-chart symbol input) — otherwise its effect (which fully tears
  // down and recreates the lightweight-charts instance on any prop
  // change) would rebuild on every keystroke, and doing that in the same
  // render that also resizes the grid layout (toggling the second chart)
  // races the chart's internal ResizeObserver against its own disposal.
  const visibleCandles = useMemo(() => candles.slice(0, visibleCount), [candles, visibleCount]);
  const currentCandle = visibleCandles[visibleCandles.length - 1] ?? null;
  const nowMs = currentCandle ? currentCandle.time * 1000 : -Infinity;

  // Only reveal each fill's marker once the replay has actually reached
  // that point in time, not immediately — a scale-in or partial exit
  // appears exactly when it happened, same as the entry/exit did before.
  const revealedExecutions = useMemo(
    () => trade.executions.filter((e) => e.timestamp.getTime() <= nowMs),
    [trade.executions, nowMs],
  );
  const showEntry = revealedExecutions.length > 0 || (currentCandle != null && nowMs >= trade.openedAt.getTime());
  const chartTrades = useMemo<ChartTrade[]>(() => {
    if (!showEntry) return [];
    return [
      {
        ...trade,
        closedAt: trade.closedAt && nowMs >= trade.closedAt.getTime() ? trade.closedAt : null,
        executions: revealedExecutions,
      },
    ];
  }, [showEntry, trade, nowMs, revealedExecutions]);

  // The second chart shares the primary's playback position rather than
  // having its own transport — it reveals whatever of its own candles
  // fall at or before the same point in time, so a different symbol at a
  // different timeframe still moves in lockstep with the main replay.
  const revealedSecondCandles = useMemo(
    () => secondCandles.filter((c) => c.time * 1000 <= nowMs),
    [secondCandles, nowMs],
  );

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
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setShowSecondChart((v) => !v);
              if (!showSecondChart && secondCandles.length === 0) loadSecondChart();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
              showSecondChart
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border-strong text-text-muted hover:bg-surface-2",
            )}
          >
            <Columns2 className="h-3.5 w-3.5" /> Second chart
          </button>
        </div>

        <div className={cn("mb-4 grid gap-4", showSecondChart ? "sm:grid-cols-2" : "grid-cols-1")}>
          <div className="rounded-lg border border-border bg-surface p-4">
            <BacktestChart candles={visibleCandles} trades={chartTrades} />
          </div>

          {showSecondChart && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <input
                  value={secondSymbol}
                  onChange={(e) => setSecondSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && loadSecondChart()}
                  placeholder="Symbol"
                  className="w-24 rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-xs text-text outline-none focus:border-accent"
                />
                <select
                  value={secondAssetType}
                  onChange={(e) => setSecondAssetType(e.target.value as (typeof SECOND_CHART_ASSET_TYPES)[number])}
                  className="rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-xs text-text outline-none focus:border-accent"
                >
                  {SECOND_CHART_ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={secondTimeframe}
                  onChange={(e) => setSecondTimeframe(e.target.value as Timeframe)}
                  className="rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-xs text-text outline-none focus:border-accent"
                >
                  {TIMEFRAME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadSecondChart}
                  disabled={isLoadingSecond || !secondSymbol.trim()}
                  className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
                >
                  {isLoadingSecond ? "Loading…" : "Load"}
                </button>
              </div>
              {secondError ? (
                <p className="py-16 text-center text-xs text-text-faint">{secondError}</p>
              ) : hasLoadedSecond ? (
                <BacktestChart candles={revealedSecondCandles} trades={[]} />
              ) : (
                <p className="py-16 text-center text-xs text-text-faint">
                  {isLoadingSecond ? "Loading…" : "Pick a symbol and click Load."}
                </p>
              )}
            </div>
          )}
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
