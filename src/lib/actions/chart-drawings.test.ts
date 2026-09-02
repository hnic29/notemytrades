import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let drawingActions: typeof import("./chart-drawings");
let sessionActions: typeof import("./backtesting");
let prisma: typeof import("@/lib/prisma").prisma;
let cleanup: () => Promise<void>;

async function makeSession() {
  return sessionActions.createSession({
    name: "S",
    symbol: "AAPL",
    assetType: "stock",
    timeframe: "1h",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
  });
}

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  drawingActions = await import("./chart-drawings");
  sessionActions = await import("./backtesting");
  ({ prisma } = await import("@/lib/prisma"));
}, 30000);

afterAll(() => cleanup());

describe("chart drawing actions", () => {
  it("createDrawing stores a horizontal line with only price1 set", async () => {
    const session = await makeSession();
    const drawing = await drawingActions.createDrawing(session.id, { type: "horizontal", price: 123.45 });
    expect(drawing.type).toBe("horizontal");
    expect(drawing.price1).toBe(123.45);
    expect(drawing.time1).toBeNull();
    expect(drawing.time2).toBeNull();
    expect(drawing.price2).toBeNull();
  });

  it("createDrawing stores a trendline with both points", async () => {
    const session = await makeSession();
    const drawing = await drawingActions.createDrawing(session.id, {
      type: "trendline",
      time1: 1000,
      price1: 100,
      time2: 2000,
      price2: 110,
    });
    expect(drawing.type).toBe("trendline");
    expect(drawing.time1).toBe(1000);
    expect(drawing.price1).toBe(100);
    expect(drawing.time2).toBe(2000);
    expect(drawing.price2).toBe(110);
  });

  it("clearDrawings removes only the given session's drawings", async () => {
    const sessionA = await makeSession();
    const sessionB = await makeSession();
    await drawingActions.createDrawing(sessionA.id, { type: "horizontal", price: 1 });
    await drawingActions.createDrawing(sessionB.id, { type: "horizontal", price: 2 });

    await drawingActions.clearDrawings(sessionA.id);

    expect(await prisma.chartDrawing.count({ where: { sessionId: sessionA.id } })).toBe(0);
    expect(await prisma.chartDrawing.count({ where: { sessionId: sessionB.id } })).toBe(1);
  });
});
