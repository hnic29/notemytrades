"use client";

import { useEffect, useRef } from "react";
import type { DailyCandle } from "@/lib/market-data/yahoo";

export function TradeChart({
  candles,
  entryPrice,
  exitPrice,
}: {
  candles: DailyCandle[];
  entryPrice: number;
  exitPrice: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let chart: import("lightweight-charts").IChartApi | undefined;

    import("lightweight-charts").then(({ createChart, ColorType, LineStyle, CandlestickSeries }) => {
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
        height: 360,
        timeScale: { borderColor: "#232c40" },
        rightPriceScale: { borderColor: "#232c40" },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#f43f5e",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#f43f5e",
      });
      series.setData(candles);

      series.createPriceLine({
        price: entryPrice,
        color: "#2dd4bf",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: "Entry",
      });
      if (exitPrice != null) {
        series.createPriceLine({
          price: exitPrice,
          color: "#f59e0b",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: "Exit",
        });
      }

      chart.timeScale().fitContent();

      const handleResize = () => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    });

    return () => {
      disposed = true;
      chart?.remove();
    };
  }, [candles, entryPrice, exitPrice]);

  return <div ref={containerRef} className="w-full" />;
}
