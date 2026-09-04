import type { ChartDrawing } from "@/components/backtesting/BacktestChart";

type DrawingRow = {
  id: string;
  type: string;
  time1: number | null;
  price1: number | null;
  time2: number | null;
  price2: number | null;
  label: string | null;
};

/** Prisma's ChartDrawing row has every field nullable regardless of
 * type (SQLite has one physical shape for all drawing kinds) — this is
 * the single place that narrows a row into the type-specific shape
 * BacktestChart actually wants, shared by the session page and the
 * public share page so they can't drift. */
export function mapChartDrawing(d: DrawingRow): ChartDrawing {
  switch (d.type) {
    case "horizontal":
      return { id: d.id, type: "horizontal", price1: d.price1!, time1: null, time2: null, price2: null };
    case "vertical":
      return { id: d.id, type: "vertical", time1: d.time1!, price1: null, time2: null, price2: null };
    case "text":
      return {
        id: d.id,
        type: "text",
        time1: d.time1!,
        price1: d.price1!,
        time2: null,
        price2: null,
        label: d.label ?? "",
      };
    default:
      return {
        id: d.id,
        type: d.type as "trendline" | "ray" | "rectangle" | "fibonacci" | "arrow",
        time1: d.time1!,
        price1: d.price1!,
        time2: d.time2!,
        price2: d.price2!,
      };
  }
}
