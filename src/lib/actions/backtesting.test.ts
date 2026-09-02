import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./backtesting");
let prisma: typeof import("@/lib/prisma").prisma;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./backtesting");
  ({ prisma } = await import("@/lib/prisma"));
}, 30000);

afterAll(() => cleanup());

describe("backtesting actions", () => {
  it("createSession reuses the shared 'Backtesting' account across sessions", async () => {
    const a = await actions.createSession({
      name: "S1",
      symbol: "aapl",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const b = await actions.createSession({
      name: "S2",
      symbol: "msft",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    expect(a.accountId).toBe(b.accountId);
    expect(a.symbol).toBe("AAPL");
  });

  it("placeBacktestTrade creates an open, isBacktest trade with one entry execution", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const trade = await actions.placeBacktestTrade(session.id, {
      accountId: session.accountId!,
      symbol: "TSLA",
      assetType: "stock",
      side: "long",
      quantity: 10,
      entryPrice: 200,
      entryTime: "2026-01-01T10:00:00.000Z",
      stopLoss: null,
      profitTarget: null,
      autoBreakevenR: null,
    });
    expect(trade.status).toBe("open");
    expect(trade.isBacktest).toBe(true);
    expect(trade.backtestSessionId).toBe(session.id);

    const executions = await prisma.execution.findMany({ where: { tradeId: trade.id } });
    expect(executions).toHaveLength(1);
    expect(executions[0].isEntry).toBe(true);
  });

  it("closeBacktestTrade computes P&L and adds an exit execution", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const trade = await actions.placeBacktestTrade(session.id, {
      accountId: session.accountId!,
      symbol: "TSLA",
      assetType: "stock",
      side: "long",
      quantity: 10,
      entryPrice: 200,
      entryTime: "2026-01-01T10:00:00.000Z",
      stopLoss: null,
      profitTarget: null,
      autoBreakevenR: null,
    });

    await actions.closeBacktestTrade(trade.id, session.id, {
      exitPrice: 220,
      exitTime: "2026-01-01T11:00:00.000Z",
    });

    const after = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(after.status).toBe("closed");
    expect(after.netPnl).toBe(200); // (220-200)*10

    const executions = await prisma.execution.findMany({ where: { tradeId: trade.id } });
    expect(executions).toHaveLength(2);
    expect(executions.some((e) => !e.isEntry)).toBe(true);
  });

  it("completeSession flips status to completed", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    await actions.completeSession(session.id);
    expect((await prisma.backtestSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe(
      "completed",
    );
  });

  it("deleteSession cascades to delete its trades", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const trade = await actions.placeBacktestTrade(session.id, {
      accountId: session.accountId!,
      symbol: "TSLA",
      assetType: "stock",
      side: "long",
      quantity: 10,
      entryPrice: 200,
      entryTime: "2026-01-01T10:00:00.000Z",
      stopLoss: null,
      profitTarget: null,
      autoBreakevenR: null,
    });

    await actions.deleteSession(session.id);

    expect(await prisma.trade.findUnique({ where: { id: trade.id } })).toBeNull();
  });

  it("generateSessionShareLink is idempotent", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const first = await actions.generateSessionShareLink(session.id);
    const second = await actions.generateSessionShareLink(session.id);
    expect(second).toBe(first);
  });

  it("placePendingOrder creates a pending order; evaluateCandleForSession fills it when the candle's range touches the trigger", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const order = await actions.placePendingOrder(session.id, {
      symbol: "TSLA",
      side: "long",
      orderType: "limit",
      triggerPrice: 190,
      quantity: 10,
      stopLoss: null,
      profitTarget: null,
      autoBreakevenR: null,
    });
    expect(order.status).toBe("pending");

    const result = await actions.evaluateCandleForSession(
      session.id,
      session.accountId!,
      "stock",
      { time: 1735732800, open: 195, high: 196, low: 188, close: 192 },
    );
    expect(result.filledOrderIds).toEqual([order.id]);

    const filled = await prisma.backtestOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(filled.status).toBe("filled");
    expect(filled.filledTradeId).not.toBeNull();

    const trade = await prisma.trade.findUniqueOrThrow({ where: { id: filled.filledTradeId! } });
    expect(trade.status).toBe("open");
    expect(trade.avgEntryPrice).toBe(190); // opened below the limit price, so fills at the trigger
  });

  it("evaluateCandleForSession moves the open trade's stop to breakeven once autoBreakevenR is reached", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const trade = await actions.placeBacktestTrade(session.id, {
      accountId: session.accountId!,
      symbol: "TSLA",
      assetType: "stock",
      side: "long",
      quantity: 10,
      entryPrice: 200,
      entryTime: "2026-01-01T10:00:00.000Z",
      stopLoss: 195, // 5 risk/unit
      profitTarget: null,
      autoBreakevenR: 1,
    });

    const result = await actions.evaluateCandleForSession(
      session.id,
      session.accountId!,
      "stock",
      { time: 1735736400, open: 204, high: 206, low: 203, close: 205 }, // +6 favorable move = 1.2R
    );
    expect(result.breakevenApplied).toBe(true);

    const after = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(after.stopLoss).toBe(200);
  });

  it("runAutoBacktest rejects risk-% sizing against a $0 starting balance", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    await expect(
      actions.runAutoBacktest(session.id, session.accountId!, "stock", {
        side: "long",
        entry: { left: { type: "price" }, comparison: "greater_than", right: { type: "value", value: 0 } },
        exit: { stopLossPct: 1 },
        positionSizing: { type: "riskPercent", percent: 1 },
      }),
    ).rejects.toThrow(/starting balance/i);
  });

  it("runAutoBacktest re-validates the rule and rejects a malformed one, even called directly (bypassing parseBacktestRule)", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      assetType: "stock",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    // @ts-expect-error — deliberately malformed to prove the server
    // action itself validates, not just the AI-parsing step upstream.
    await expect(actions.runAutoBacktest(session.id, session.accountId!, "stock", { not: "a rule" })).rejects.toThrow();

    await expect(
      actions.runAutoBacktest(session.id, session.accountId!, "stock", {
        side: "long",
        entry: { left: { type: "price" }, comparison: "greater_than", right: { type: "value", value: 0 } },
        exit: {}, // neither takeProfitPct nor stopLossPct — invalid per the schema's refine()
        positionSizing: { type: "fixedQuantity", quantity: 1 },
      }),
    ).rejects.toThrow();
  });
});
