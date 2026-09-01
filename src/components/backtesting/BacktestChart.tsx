"use client";

import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/market-data/yahoo";

export type ChartTrade = {
  openedAt: Date;
  closedAt: Date | null;
  side: string;
  avgEntryPrice: number;
  avgExitPrice: number | null;
};

export function BacktestChart({
  candles,
  trades,
}: {
  candles: Candle[];
  trades: ChartTrade[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let chart: import("lightweight-charts").IChartApi | undefined;

    import("lightweight-charts").then(
      ({ createChart, ColorType, CandlestickSeries, createSeriesMarkers }) => {
        if (disposed || !containerRef.current) return;

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

        const series = chart.addSeries(CandlestickSeries, {
          upColor: "#22c55e",
          downColor: "#f43f5e",
          borderVisible: false,
          wickUpColor: "#22c55e",
          wickDownColor: "#f43f5e",
        });
        // lightweight-charts requires strictly ascending, de-duplicated
        // time values — Yahoo's intraday feed can repeat a timestamp
        // across payload boundaries.
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

        const markers = trades.flatMap((t) => {
          const entryTime = Math.floor(t.openedAt.getTime() / 1000);
          const list: import("lightweight-charts").SeriesMarker<import("lightweight-charts").UTCTimestamp>[] =
            [
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
        if (markers.length > 0) createSeriesMarkers(series, markers);

        chart.timeScale().fitContent();

        const handleResize = () => {
          if (containerRef.current && chart) {
            chart.applyOptions({ width: containerRef.current.clientWidth });
          }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
      },
    );

    return () => {
      disposed = true;
      chart?.remove();
    };
  }, [candles, trades]);

  return <div ref={containerRef} className="w-full" />;
}
