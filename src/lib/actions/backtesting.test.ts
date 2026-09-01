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
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const b = await actions.createSession({
      name: "S2",
      symbol: "msft",
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
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const trade = await actions.placeBacktestTrade(session.id, {
      accountId: session.accountId!,
      symbol: "TSLA",
      side: "long",
      quantity: 10,
      entryPrice: 200,
      entryTime: "2026-01-01T10:00:00.000Z",
      stopLoss: null,
      profitTarget: null,
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
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const trade = await actions.placeBacktestTrade(session.id, {
      accountId: session.accountId!,
      symbol: "TSLA",
      side: "long",
      quantity: 10,
      entryPrice: 200,
      entryTime: "2026-01-01T10:00:00.000Z",
      stopLoss: null,
      profitTarget: null,
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
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const trade = await actions.placeBacktestTrade(session.id, {
      accountId: session.accountId!,
      symbol: "TSLA",
      side: "long",
      quantity: 10,
      entryPrice: 200,
      entryTime: "2026-01-01T10:00:00.000Z",
      stopLoss: null,
      profitTarget: null,
    });

    await actions.deleteSession(session.id);

    expect(await prisma.trade.findUnique({ where: { id: trade.id } })).toBeNull();
  });

  it("generateSessionShareLink is idempotent", async () => {
    const session = await actions.createSession({
      name: "S",
      symbol: "TSLA",
      timeframe: "1h",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const first = await actions.generateSessionShareLink(session.id);
    const second = await actions.generateSessionShareLink(session.id);
    expect(second).toBe(first);
  });
});
