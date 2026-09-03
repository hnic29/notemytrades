"use client";

import { useEffect, useRef, useState } from "react";
import { MousePointer2, Minus, TrendingUp, Eraser } from "lucide-react";
import type { Candle } from "@/lib/market-data/yahoo";
import type { DrawingInput } from "@/lib/actions/chart-drawings";
import { cn } from "@/lib/utils";

export type ChartExecution = {
  id: string;
  side: string; // "buy" | "sell"
  quantity: number;
  price: number;
  timestamp: Date;
  isEntry: boolean;
};

export type ChartTrade = {
  openedAt: Date;
  closedAt: Date | null;
  side: string;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  /** Individual fills, oldest first — when present, each gets its own
   * marker (Entry/Add/Trim/Exit) instead of collapsing the trade down
   * to one entry + one exit arrow. Lets a scale-in or partial-out show
   * up exactly where and when it happened, same as the trade's real fills. */
  executions?: ChartExecution[];
};

export type ChartDrawing =
  | { id: string; type: "horizontal"; price1: number; time1: null; price2: null; time2: null }
  | { id: string; type: "trendline"; time1: number; price1: number; time2: number; price2: number };

type Tool = "cursor" | "trendline" | "horizontal";

const ZOOM_PRESETS: { label: string; days: number | null }[] = [
  { label: "1D", days: 1 },
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "All", days: null },
];

/**
 * lightweight-charts' Line series requires strictly ascending, unique
 * time values — a trend line drawn right-to-left, or two clicks landing
 * in the same bar (very possible when zoomed out), would otherwise
 * violate that and crash the chart. Sorts the two points by time and
 * returns null when they land on the same bar, since a two-point line
 * with an equal time isn't a valid line to draw at all.
 */
function orderByTime(
  a: { time: number; price: number },
  b: { time: number; price: number },
): [{ time: number; price: number }, { time: number; price: number }] | null {
  if (a.time === b.time) return null;
  return a.time < b.time ? [a, b] : [b, a];
}

function buildMarkers(
  trades: ChartTrade[],
): import("lightweight-charts").SeriesMarker<import("lightweight-charts").UTCTimestamp>[] {
  return trades.flatMap((t) => {
    if (t.executions && t.executions.length > 0) {
      const entryFills = t.executions.filter((e) => e.isEntry);
      const exitFills = t.executions.filter((e) => !e.isEntry);
      const fillMarkers: import("lightweight-charts").SeriesMarker<import("lightweight-charts").UTCTimestamp>[] =
        t.executions.map((e) => {
          const isFirstEntry = e.isEntry && e === entryFills[0];
          const isLastExit = !e.isEntry && e === exitFills[exitFills.length - 1];
          const label = e.isEntry ? (isFirstEntry ? "Entry" : "Add") : isLastExit ? "Exit" : "Trim";
          return {
            time: Math.floor(e.timestamp.getTime() / 1000) as import("lightweight-charts").UTCTimestamp,
            position: e.side === "buy" ? "belowBar" : "aboveBar",
            color: e.isEntry ? "#2dd4bf" : "#f59e0b",
            shape: e.side === "buy" ? "arrowUp" : "arrowDown",
            text: label,
          };
        });
      return fillMarkers;
    }

    const entryTime = Math.floor(t.openedAt.getTime() / 1000);
    const list: import("lightweight-charts").SeriesMarker<import("lightweight-charts").UTCTimestamp>[] = [
      {
        time: entryTime as import("lightweight-charts").UTCTimestamp,
        position: t.side === "long" ? "belowBar" : "aboveBar",
        color: "#2dd4bf",
        shape: t.side === "long" ? "arrowUp" : "arrowDown",
        text: "Entry",
      },
    ];
    if (t.closedAt && t.avgExitPrice != null) {
      list.push({
        time: Math.floor(t.closedAt.getTime() / 1000) as import("lightweight-charts").UTCTimestamp,
        position: t.side === "long" ? "aboveBar" : "belowBar",
        color: "#f59e0b",
        shape: t.side === "long" ? "arrowDown" : "arrowUp",
        text: "Exit",
      });
    }
    return list;
  });
}

export function BacktestChart({
  candles,
  trades,
  drawings = [],
  onCreateDrawing,
  onClearDrawings,
}: {
  candles: Candle[];
  trades: ChartTrade[];
  drawings?: ChartDrawing[];
  onCreateDrawing?: (input: DrawingInput) => void;
  onClearDrawings?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<import("lightweight-charts").IChartApi | null>(null);
  const seriesRef = useRef<import("lightweight-charts").ISeriesApi<"Candlestick"> | null>(null);
  const markersApiRef = useRef<import("lightweight-charts").ISeriesMarkersPluginApi<
    import("lightweight-charts").Time
  > | null>(null);
  // The library module itself, cached from the one dynamic import at
  // creation — later effects (drawings) need series-type constructors
  // like LineSeries without re-triggering a fresh import.
  const libRef = useRef<typeof import("lightweight-charts") | null>(null);
  const drawingArtifactsRef = useRef<{
    priceLines: import("lightweight-charts").IPriceLine[];
    lineSeries: import("lightweight-charts").ISeriesApi<"Line">[];
  }>({ priceLines: [], lineSeries: [] });
  // Flips true once the chart/series/markers API actually exist (the
  // dynamic import resolves asynchronously) — gates the data/markers/
  // drawings effects so they don't run against refs that aren't set yet.
  const [chartReady, setChartReady] = useState(false);
  const [tool, setTool] = useState<Tool>("cursor");
  const toolRef = useRef<Tool>("cursor");
  const pendingPointRef = useRef<{ time: number; price: number } | null>(null);
  // Mirrors pendingPointRef purely so the "click a start/end point" hint
  // below the chart re-renders — the ref itself is only read inside the
  // chart effect's closures, which don't re-render on mutation.
  const [hasPendingPoint, setHasPendingPoint] = useState(false);
  // Latest callback in a ref so the chart-creation effect below doesn't
  // need it as a dependency — an inline arrow function from the parent
  // would otherwise recreate the whole chart on every parent render.
  const onCreateDrawingRef = useRef(onCreateDrawing);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    onCreateDrawingRef.current = onCreateDrawing;
  }, [onCreateDrawing]);

  // Selecting a tool also abandons any in-progress trend line — done
  // here, at the point the change originates, rather than reactively in
  // an effect on `tool` (which would call setState synchronously inside
  // an effect just to undo what the same click already triggered).
  const selectTool = (next: Tool) => {
    setTool(next);
    pendingPointRef.current = null;
    setHasPendingPoint(false);
  };

  // Creates the chart exactly once and tears it down only on unmount.
  // Candle data, markers and drawings are pushed into the still-live
  // chart by the effects below instead of triggering a full rebuild —
  // rebuilding on every playback tick (candles/trades change constantly
  // during replay) used to recreate the whole lightweight-charts
  // instance dozens of times a second at high playback speed, which can
  // race the library's own internal resize handling against a chart
  // that's mid-disposal and throw "Object is disposed".
  useEffect(() => {
    let disposed = false;
    let chart: import("lightweight-charts").IChartApi | undefined;
    let cleanupExtras = () => {};

    import("lightweight-charts").then((lib) => {
      if (disposed || !containerRef.current) return;
      const { createChart, ColorType, CandlestickSeries, createSeriesMarkers } = lib;
      libRef.current = lib;

      chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#93a0b8",
        },
        grid: {
          vertLines: { color: "#232c40" },
          horzLines: { color: "#232c40" },
        },
        width: containerRef.current.clientWidth,
        height: 420,
        timeScale: { borderColor: "#232c40", timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderColor: "#232c40" },
      });
      chartRef.current = chart;

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#f43f5e",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#f43f5e",
      });
      seriesRef.current = series;
      markersApiRef.current = createSeriesMarkers(series, []);

      // Click-to-draw: horizontal completes on one click; a trend line
      // takes two. No live preview line follows the cursor in between —
      // calling series.setData() from inside subscribeCrosshairMove
      // makes lightweight-charts re-fire that same event internally,
      // which recurses into itself and blows the call stack. The text
      // hint below the chart ("click the end point…") stands in for it.
      const clickHandler = (param: import("lightweight-charts").MouseEventParams) => {
        const activeTool = toolRef.current;
        if (activeTool === "cursor" || !param.point || param.time == null) return;
        const price = series.coordinateToPrice(param.point.y);
        if (price == null) return;
        const time = param.time as number;

        if (activeTool === "horizontal") {
          onCreateDrawingRef.current?.({ type: "horizontal", price });
          setTool("cursor");
          return;
        }

        if (!pendingPointRef.current) {
          pendingPointRef.current = { time, price };
          setHasPendingPoint(true);
        } else {
          const a = pendingPointRef.current;
          if (time === a.time) return; // same bar as the start point — not a line, ignore
          onCreateDrawingRef.current?.({ type: "trendline", time1: a.time, price1: a.price, time2: time, price2: price });
          pendingPointRef.current = null;
          setHasPendingPoint(false);
          setTool("cursor");
        }
      };
      chart.subscribeClick(clickHandler);

      const handleResize = () => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      };
      window.addEventListener("resize", handleResize);

      cleanupExtras = () => {
        window.removeEventListener("resize", handleResize);
        chart?.unsubscribeClick(clickHandler);
      };

      setChartReady(true);
    });

    return () => {
      disposed = true;
      cleanupExtras();
      chart?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersApiRef.current = null;
      libRef.current = null;
      drawingArtifactsRef.current = { priceLines: [], lineSeries: [] };
    };
  }, []);

  // Push new candle data into the existing series and keep the view
  // following the growing range, same as the old single-effect version did.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!chartReady || !series || !chart) return;
    // lightweight-charts requires strictly ascending, de-duplicated time
    // values — Yahoo's intraday feed can repeat a timestamp across
    // payload boundaries.
    const seen = new Set<number>();
    const data = candles
      .filter((c) => {
        if (seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
      })
      .sort((a, b) => a.time - b.time)
      .map((c) => ({ ...c, time: c.time as import("lightweight-charts").UTCTimestamp }));
    series.setData(data);
    chart.timeScale().fitContent();
  }, [candles, chartReady]);

  useEffect(() => {
    if (!chartReady) return;
    markersApiRef.current?.setMarkers(buildMarkers(trades));
  }, [trades, chartReady]);

  // Persisted drawings — a horizontal line uses the series' own native
  // price-line support; a trend line is a real 2-point Line series, so
  // both stay correctly positioned on pan/zoom without any manual
  // coordinate math. Old artifacts are removed before the new ones are
  // added, since this effect can re-run with a different drawing set.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const lib = libRef.current;
    if (!chartReady || !chart || !series || !lib) return;

    for (const priceLine of drawingArtifactsRef.current.priceLines) series.removePriceLine(priceLine);
    for (const lineSeries of drawingArtifactsRef.current.lineSeries) chart.removeSeries(lineSeries);

    const priceLines: import("lightweight-charts").IPriceLine[] = [];
    const lineSeriesList: import("lightweight-charts").ISeriesApi<"Line">[] = [];
    for (const d of drawings) {
      if (d.type === "horizontal") {
        priceLines.push(
          series.createPriceLine({
            price: d.price1,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
          }),
        );
      } else {
        const ordered = orderByTime({ time: d.time1, price: d.price1 }, { time: d.time2, price: d.price2 });
        if (!ordered) continue; // degenerate (equal-time) drawing — nothing valid to render
        const line = chart.addSeries(lib.LineSeries, {
          color: "#f59e0b",
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        line.setData([
          { time: ordered[0].time as import("lightweight-charts").UTCTimestamp, value: ordered[0].price },
          { time: ordered[1].time as import("lightweight-charts").UTCTimestamp, value: ordered[1].price },
        ]);
        lineSeriesList.push(line);
      }
    }
    drawingArtifactsRef.current = { priceLines, lineSeries: lineSeriesList };
  }, [drawings, chartReady]);

  const applyZoom = (days: number | null) => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;
    if (days == null) {
      chart.timeScale().fitContent();
      return;
    }
    const lastTime = candles[candles.length - 1].time;
    const from = lastTime - days * 86400;
    chart
      .timeScale()
      .setVisibleRange({
        from: from as import("lightweight-charts").UTCTimestamp,
        to: lastTime as import("lightweight-charts").UTCTimestamp,
      });
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {ZOOM_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyZoom(p.days)}
              className="rounded-md border border-border-strong px-2 py-1 text-xs text-text-muted hover:border-accent/50 hover:text-accent"
            >
              {p.label}
            </button>
          ))}
        </div>

        {onCreateDrawing && (
          <div className="flex items-center gap-1">
            <ToolButton active={tool === "cursor"} onClick={() => selectTool("cursor")} title="Cursor">
              <MousePointer2 className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton active={tool === "trendline"} onClick={() => selectTool("trendline")} title="Trend line">
              <TrendingUp className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              active={tool === "horizontal"}
              onClick={() => selectTool("horizontal")}
              title="Horizontal line"
            >
              <Minus className="h-3.5 w-3.5" />
            </ToolButton>
            {onClearDrawings && drawings.length > 0 && (
              <button
                type="button"
                onClick={onClearDrawings}
                title="Clear all drawings"
                className="rounded-md border border-border-strong p-1.5 text-text-faint hover:border-loss/50 hover:text-loss"
              >
                <Eraser className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {onCreateDrawing && tool === "trendline" && (
        <p className="mb-2 text-xs text-accent">
          {hasPendingPoint ? "Click the end point…" : "Click a start point…"}
        </p>
      )}
      {onCreateDrawing && tool === "horizontal" && (
        <p className="mb-2 text-xs text-accent">Click a price to place the line…</p>
      )}

      <div ref={containerRef} className="w-full" />
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-md border p-1.5",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border-strong text-text-muted hover:border-accent/50 hover:text-accent",
      )}
    >
      {children}
    </button>
  );
}
