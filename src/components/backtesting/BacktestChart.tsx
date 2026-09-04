"use client";

import { useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  Minus,
  TrendingUp,
  Eraser,
  MoveRight,
  SeparatorVertical,
  Square,
  Percent,
  Type,
  ArrowUpRight,
} from "lucide-react";
import type { Candle } from "@/lib/market-data/yahoo";
import type { DrawingInput } from "@/lib/actions/chart-drawings";
import { DrawingsPrimitive, type PrimitiveDrawing } from "./drawing-primitives";
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
  | { id: string; type: "vertical"; time1: number; price1: null; time2: null; price2: null }
  | { id: string; type: "text"; time1: number; price1: number; time2: null; price2: null; label: string }
  | {
      id: string;
      type: "trendline" | "ray" | "rectangle" | "fibonacci" | "arrow";
      time1: number;
      price1: number;
      time2: number;
      price2: number;
    };

type Tool = "cursor" | "trendline" | "ray" | "horizontal" | "vertical" | "rectangle" | "fibonacci" | "arrow" | "text";

/** Tools that place their line/box via two clicks (start point, then end
 * point) — as opposed to "horizontal"/"vertical"/"text", which place with
 * a single click. */
const TWO_CLICK_TOOLS = new Set<Tool>(["trendline", "ray", "rectangle", "fibonacci", "arrow"]);

/** Standard retracement ratios, 0% (price1) through 100% (price2). */
const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

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
  // Vertical/rectangle/text/arrow draw through DrawingsPrimitive (custom
  // canvas rendering) instead of a lightweight-charts series — this ref
  // is what its getData() closure reads, kept live by the drawings effect.
  const primitiveRef = useRef<DrawingsPrimitive | null>(null);
  const primitiveDataRef = useRef<PrimitiveDrawing[]>([]);
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

      const primitive = new DrawingsPrimitive(() => primitiveDataRef.current);
      series.attachPrimitive(primitive);
      primitiveRef.current = primitive;

      // Click-to-draw: horizontal/vertical/text complete on one click; the
      // rest take two. No live preview line follows the cursor in between —
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
        if (activeTool === "vertical") {
          onCreateDrawingRef.current?.({ type: "vertical", time });
          setTool("cursor");
          return;
        }
        if (activeTool === "text") {
          // A positioned inline editor would be nicer, but a native prompt
          // is a fraction of the code and works fine for a short note.
          const label = window.prompt("Note text:")?.trim();
          if (label) onCreateDrawingRef.current?.({ type: "text", time, price, label });
          setTool("cursor");
          return;
        }

        if (!pendingPointRef.current) {
          pendingPointRef.current = { time, price };
          setHasPendingPoint(true);
        } else {
          const a = pendingPointRef.current;
          if (time === a.time) return; // same bar as the start point — not a valid shape, ignore
          onCreateDrawingRef.current?.({
            type: activeTool as "trendline" | "ray" | "rectangle" | "fibonacci" | "arrow",
            time1: a.time,
            price1: a.price,
            time2: time,
            price2: price,
          });
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
        series.detachPrimitive(primitive);
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
      primitiveRef.current = null;
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

  // Persisted drawings. Each type renders through whichever mechanism
  // fits it: horizontal → the series' native price-line support;
  // trend line/ray/fibonacci → real Line series (ray extends past its
  // second point, fibonacci draws one flat segment per retracement
  // level); vertical/rectangle/text/arrow have no lightweight-charts
  // series equivalent, so they go through DrawingsPrimitive's canvas
  // rendering instead. Old line-series artifacts are removed before new
  // ones are added, since this effect re-runs with a different set.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const lib = libRef.current;
    if (!chartReady || !chart || !series || !lib) return;

    for (const priceLine of drawingArtifactsRef.current.priceLines) series.removePriceLine(priceLine);
    for (const lineSeries of drawingArtifactsRef.current.lineSeries) chart.removeSeries(lineSeries);

    const priceLines: import("lightweight-charts").IPriceLine[] = [];
    const lineSeriesList: import("lightweight-charts").ISeriesApi<"Line">[] = [];
    const primitiveDrawings: PrimitiveDrawing[] = [];

    const addLine = (
      points: { time: number; value: number }[],
      opts?: import("lightweight-charts").LineSeriesPartialOptions,
    ) => {
      const line = chart.addSeries(lib.LineSeries, {
        color: "#f59e0b",
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        ...opts,
      });
      line.setData(points.map((p) => ({ time: p.time as import("lightweight-charts").UTCTimestamp, value: p.value })));
      lineSeriesList.push(line);
    };

    const firstCandleTime = candles[0]?.time;
    const lastCandleTime = candles[candles.length - 1]?.time;
    const totalSpan = firstCandleTime != null && lastCandleTime != null ? lastCandleTime - firstCandleTime : 0;

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
        continue;
      }
      if (d.type === "vertical") {
        primitiveDrawings.push({ id: d.id, type: "vertical", time1: d.time1 });
        continue;
      }
      if (d.type === "text") {
        primitiveDrawings.push({ id: d.id, type: "text", time1: d.time1, price1: d.price1, label: d.label });
        continue;
      }
      if (d.type === "rectangle" || d.type === "arrow") {
        primitiveDrawings.push({ id: d.id, type: d.type, time1: d.time1, price1: d.price1, time2: d.time2, price2: d.price2 });
        continue;
      }

      // trendline | ray | fibonacci — all anchored on two real points.
      const ordered = orderByTime({ time: d.time1, price: d.price1 }, { time: d.time2, price: d.price2 });
      if (!ordered) continue; // degenerate (equal-time) drawing — nothing valid to render

      if (d.type === "fibonacci") {
        for (const ratio of FIBONACCI_LEVELS) {
          const level = d.price1 + (d.price2 - d.price1) * ratio;
          const isEdge = ratio === 0 || ratio === 1;
          addLine(
            [
              { time: ordered[0].time, value: level },
              { time: ordered[1].time, value: level },
            ],
            { lineWidth: isEdge ? 2 : 1, lineStyle: isEdge ? 0 : 2 },
          );
        }
        continue;
      }

      if (d.type === "ray") {
        // Extends from time1 through time2 well past the visible candle
        // range, in whichever direction that segment actually points —
        // a ray drawn "backward" in time still extends backward.
        const direction = d.time2 >= d.time1 ? 1 : -1;
        const extendBy = totalSpan > 0 ? totalSpan : Math.abs(d.time2 - d.time1) * 10 || 3600;
        let extendedTime = d.time2 + direction * extendBy;
        const slope = (d.price2 - d.price1) / (d.time2 - d.time1);
        let extendedPrice = d.price1 + slope * (extendedTime - d.time1);

        // A steep ray would otherwise extrapolate to a price far outside
        // the chart's real range, dragging the price-axis autoscale
        // along with it — cap the price reach to a generous multiple of
        // the ray's own two-point span, and shorten the time reach to
        // match (solving along the same slope) so the line stays
        // straight instead of visibly kinking at the cap.
        const maxPriceReach = (Math.abs(d.price2 - d.price1) || 1) * 10;
        const deviation = extendedPrice - d.price2;
        if (slope !== 0 && Math.abs(deviation) > maxPriceReach) {
          extendedPrice = d.price2 + Math.sign(deviation) * maxPriceReach;
          extendedTime = d.time1 + (extendedPrice - d.price1) / slope;
        }

        const points = [
          { time: d.time1, value: d.price1 },
          { time: d.time2, value: d.price2 },
          { time: extendedTime, value: extendedPrice },
        ].sort((a, b) => a.time - b.time);
        addLine(points);
        continue;
      }

      addLine([
        { time: ordered[0].time, value: ordered[0].price },
        { time: ordered[1].time, value: ordered[1].price },
      ]);
    }

    drawingArtifactsRef.current = { priceLines, lineSeries: lineSeriesList };
    primitiveDataRef.current = primitiveDrawings;
    primitiveRef.current?.requestUpdate();
  }, [drawings, chartReady, candles]);

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
      <div className="mb-2 flex items-center gap-1">
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

      <div className="flex items-start gap-2">
        {onCreateDrawing && (
          <div className="flex flex-col items-center gap-1 rounded-md border border-border bg-surface-2 p-1">
            <ToolButton active={tool === "cursor"} onClick={() => selectTool("cursor")} title="Cursor">
              <MousePointer2 className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton active={tool === "trendline"} onClick={() => selectTool("trendline")} title="Trend line">
              <TrendingUp className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton active={tool === "ray"} onClick={() => selectTool("ray")} title="Ray">
              <MoveRight className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              active={tool === "horizontal"}
              onClick={() => selectTool("horizontal")}
              title="Horizontal line"
            >
              <Minus className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton active={tool === "vertical"} onClick={() => selectTool("vertical")} title="Vertical line">
              <SeparatorVertical className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton active={tool === "rectangle"} onClick={() => selectTool("rectangle")} title="Rectangle">
              <Square className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              active={tool === "fibonacci"}
              onClick={() => selectTool("fibonacci")}
              title="Fibonacci retracement"
            >
              <Percent className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton active={tool === "arrow"} onClick={() => selectTool("arrow")} title="Arrow">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton active={tool === "text"} onClick={() => selectTool("text")} title="Text note">
              <Type className="h-3.5 w-3.5" />
            </ToolButton>
            {onClearDrawings && (
              <>
                <div className="my-0.5 h-px w-5 bg-border" />
                <button
                  type="button"
                  onClick={onClearDrawings}
                  disabled={drawings.length === 0}
                  title="Clear all drawings"
                  className="rounded-md border border-border-strong p-1.5 text-text-faint hover:border-loss/50 hover:text-loss disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-strong disabled:hover:text-text-faint"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {onCreateDrawing && TWO_CLICK_TOOLS.has(tool) && (
            <p className="mb-2 text-xs text-accent">
              {hasPendingPoint ? "Click the end point…" : "Click a start point…"}
            </p>
          )}
          {onCreateDrawing && tool === "horizontal" && (
            <p className="mb-2 text-xs text-accent">Click a price to place the line…</p>
          )}
          {onCreateDrawing && tool === "vertical" && (
            <p className="mb-2 text-xs text-accent">Click a time to place the line…</p>
          )}
          {onCreateDrawing && tool === "text" && (
            <p className="mb-2 text-xs text-accent">Click where the note should sit…</p>
          )}

          <div ref={containerRef} data-testid="backtest-chart-canvas" className="w-full" />
        </div>
      </div>
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
