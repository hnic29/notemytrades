import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

/**
 * Canvas-drawn annotations lightweight-charts has no built-in series
 * type for: a vertical line (needs one x for the whole pane height, which
 * a time-series Line can't express), a filled rectangle, a floating text
 * note, and an arrow. Everything else (trend line, ray, horizontal line,
 * fibonacci levels) reuses the library's own Line/price-line series —
 * only these four route through this primitive.
 */
export type PrimitiveDrawing =
  | { id: string; type: "vertical"; time1: number }
  | { id: string; type: "rectangle"; time1: number; price1: number; time2: number; price2: number }
  | { id: string; type: "arrow"; time1: number; price1: number; time2: number; price2: number }
  | { id: string; type: "text"; time1: number; price1: number; label: string };

const COLOR = "#f59e0b";

type RenderPoint =
  | { type: "vertical"; x: number }
  | { type: "rectangle"; x1: number; y1: number; x2: number; y2: number }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { type: "text"; x: number; y: number; label: string };

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 9;
  const headAngle = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle - headAngle), y2 - headLength * Math.sin(angle - headAngle));
  ctx.lineTo(x2 - headLength * Math.cos(angle + headAngle), y2 - headLength * Math.sin(angle + headAngle));
  ctx.closePath();
  ctx.fill();
}

class DrawingsPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private getPoints: () => RenderPoint[]) {}

  draw(target: CanvasRenderingTarget2D) {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const points = this.getPoints();
      if (points.length === 0) return;

      context.save();
      context.strokeStyle = COLOR;
      context.fillStyle = COLOR;
      context.lineWidth = 1.5;
      context.font = "12px sans-serif";
      context.textBaseline = "bottom";

      for (const p of points) {
        if (p.type === "vertical") {
          context.beginPath();
          context.moveTo(p.x, 0);
          context.lineTo(p.x, mediaSize.height);
          context.stroke();
        } else if (p.type === "rectangle") {
          const x = Math.min(p.x1, p.x2);
          const y = Math.min(p.y1, p.y2);
          const w = Math.abs(p.x2 - p.x1);
          const h = Math.abs(p.y2 - p.y1);
          context.globalAlpha = 0.12;
          context.fillRect(x, y, w, h);
          context.globalAlpha = 1;
          context.strokeRect(x, y, w, h);
        } else if (p.type === "arrow") {
          drawArrow(context, p.x1, p.y1, p.x2, p.y2);
        } else {
          context.beginPath();
          context.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          context.fill();
          context.fillText(p.label, p.x + 6, p.y - 4);
        }
      }
      context.restore();
    });
  }
}

class DrawingsPaneView implements IPrimitivePaneView {
  constructor(private primitive: DrawingsPrimitive) {}
  renderer() {
    return new DrawingsPaneRenderer(() => this.primitive.computeRenderPoints());
  }
}

/**
 * Reads its data lazily from `getData` (kept live via a ref in
 * BacktestChart, not re-attached when drawings change) so updating the
 * drawing set is just a `requestUpdate()` call, not a re-attach.
 */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdateFn: (() => void) | null = null;
  private view = new DrawingsPaneView(this);

  constructor(private getData: () => PrimitiveDrawing[]) {}

  attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.series = series;
    this.requestUpdateFn = requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdateFn = null;
  }

  updateAllViews() {}

  paneViews() {
    return [this.view];
  }

  requestUpdate() {
    this.requestUpdateFn?.();
  }

  computeRenderPoints(): RenderPoint[] {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return [];
    const toX = (t: number) => chart.timeScale().timeToCoordinate(t as Time);
    const toY = (p: number) => series.priceToCoordinate(p);

    const points: RenderPoint[] = [];
    for (const d of this.getData()) {
      if (d.type === "vertical") {
        const x = toX(d.time1);
        if (x != null) points.push({ type: "vertical", x });
      } else if (d.type === "text") {
        const x = toX(d.time1);
        const y = toY(d.price1);
        if (x != null && y != null) points.push({ type: "text", x, y, label: d.label });
      } else {
        const x1 = toX(d.time1);
        const y1 = toY(d.price1);
        const x2 = toX(d.time2);
        const y2 = toY(d.price2);
        if (x1 != null && y1 != null && x2 != null && y2 != null) {
          points.push({ type: d.type, x1, y1, x2, y2 });
        }
      }
    }
    return points;
  }
}
