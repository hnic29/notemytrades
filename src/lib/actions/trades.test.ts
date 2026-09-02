import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";
import type { Prisma } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./trades");
let prisma: typeof import("@/lib/prisma").prisma;
let cleanup: () => Promise<void>;
let accountId: string;

async function makeTrade(overrides: Partial<Prisma.TradeUncheckedCreateInput> = {}) {
  return prisma.trade.create({
    data: {
      accountId,
      symbol: "AAPL",
      assetType: "stock",
      side: "long",
      status: "closed",
      openedAt: new Date("2026-01-01T09:30:00Z"),
      closedAt: new Date("2026-01-01T10:00:00Z"),
      quantity: 100,
      avgEntryPrice: 150,
      avgExitPrice: 160,
      netPnl: 1000,
      fees: 0,
      commissions: 0,
      ...overrides,
    },
  });
}

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./trades");
  ({ prisma } = await import("@/lib/prisma"));
  const account = await prisma.account.create({ data: { name: "A", assetType: "mixed", currency: "USD" } });
  accountId = account.id;
}, 30000);

afterAll(() => cleanup());

describe("splitTrade", () => {
  it("splits quantity and halves fees/commissions across both resulting trades", async () => {
    const trade = await makeTrade({ quantity: 100, netPnl: 1000, fees: 10, commissions: 10 });

    const result = await actions.splitTrade(trade.id, 40);
    expect(result.ok).toBe(true);

    const remaining = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(remaining.quantity).toBe(40);
    expect(remaining.fees).toBe(5);
    expect(remaining.commissions).toBe(5);
    expect(remaining.netPnl).toBeCloseTo(40 * (160 - 150) - 5 - 5);

    const siblings = await prisma.trade.findMany({ where: { symbol: "AAPL" }, orderBy: { quantity: "asc" } });
    expect(siblings).toHaveLength(2);
    const remainder = siblings.find((t) => t.id !== trade.id)!;
    expect(remainder.quantity).toBe(60);
    expect(remainder.netPnl).toBeCloseTo(60 * (160 - 150) - 5 - 5);
  });

  it("returns a typed error instead of throwing when keepQuantity is out of range", async () => {
    const trade = await makeTrade({ quantity: 10 });
    const tooHigh = await actions.splitTrade(trade.id, 10);
    const tooLow = await actions.splitTrade(trade.id, 0);
    expect(tooHigh).toEqual({ ok: false, error: expect.stringContaining("between") });
    expect(tooLow).toEqual({ ok: false, error: expect.stringContaining("between") });

    // Confirm the trade was left untouched by the rejected split.
    const unchanged = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(unchanged.quantity).toBe(10);
  });
});

describe("bulkImportTrades", () => {
  const row = {
    symbol: "MNQ",
    side: "short" as const,
    quantity: 1,
    multiplier: 2,
    avgEntryPrice: 29203,
    avgExitPrice: 29195.5,
    openedAt: "2026-09-01T09:22:35.000Z",
    closedAt: "2026-09-01T09:26:23.000Z",
    fees: 0,
    commissions: 0,
    netPnl: 15,
    netRoi: 15 / (29203 * 2),
  };

  it("stores the multiplier and reports how many rows were imported", async () => {
    const result = await actions.bulkImportTrades(accountId, "futures", "tradingview-paper", [row]);
    expect(result).toEqual({ imported: 1, duplicates: 0 });
    const stored = await prisma.trade.findFirstOrThrow({ where: { accountId, symbol: "MNQ" } });
    expect(stored.multiplier).toBe(2);
    expect(stored.source).toBe("csv:tradingview-paper");
  });

  it("skips rows already in the account on re-import, but not identical rows in the same batch", async () => {
    const other = { ...row, openedAt: "2026-09-01T10:00:00.000Z", closedAt: "2026-09-01T10:05:00.000Z" };
    // Re-import of the overlapping window: `row` is already there.
    const second = await actions.bulkImportTrades(accountId, "futures", "tradingview-paper", [row, other]);
    expect(second).toEqual({ imported: 1, duplicates: 1 });

    // Two genuinely separate scalps that happen to share every field
    // must both land — dedup is only against what's already stored.
    const twin = { ...row, openedAt: "2026-09-01T11:00:00.000Z", closedAt: "2026-09-01T11:00:30.000Z" };
    const third = await actions.bulkImportTrades(accountId, "futures", "tradingview-paper", [twin, twin]);
    expect(third).toEqual({ imported: 2, duplicates: 0 });

    // Same trade in a different account is not a duplicate.
    const otherAccount = await prisma.account.create({ data: { name: "B", assetType: "mixed", currency: "USD" } });
    const fourth = await actions.bulkImportTrades(otherAccount.id, "futures", "tradingview-paper", [row]);
    expect(fourth).toEqual({ imported: 1, duplicates: 0 });
  });

  it("treats the same fills stamped a second apart as one trade, but not a different price", async () => {
    // TradingView's CSV carries the order's closing time, its API the
    // fill time; they can differ by a second for the same trade.
    const synced = {
      ...row,
      symbol: "MES",
      openedAt: "2026-09-01T16:58:37.000Z",
      closedAt: "2026-09-01T17:00:02.000Z",
    };
    expect(await actions.bulkImportTrades(accountId, "futures", "tradingview:paper", [synced])).toEqual({
      imported: 1,
      duplicates: 0,
    });

    const fromCsv = { ...synced, closedAt: "2026-09-01T17:00:03.000Z" };
    const farApart = { ...synced, closedAt: "2026-09-01T17:00:30.000Z" };
    const otherPrice = { ...synced, avgExitPrice: 29195.75 };
    expect(
      await actions.bulkImportTrades(accountId, "futures", "tradingview-paper", [fromCsv, farApart, otherPrice]),
    ).toEqual({ imported: 2, duplicates: 1 });

    // Each stored trade is claimed once: two near-identical candidates
    // against one stored trade yield one duplicate and one new trade.
    const nearTwin = { ...synced, openedAt: "2026-09-01T16:58:38.000Z", symbol: "M2K" };
    await actions.bulkImportTrades(accountId, "futures", "tradingview:paper", [{ ...nearTwin, openedAt: "2026-09-01T16:58:37.000Z" }]);
    expect(
      await actions.bulkImportTrades(accountId, "futures", "tradingview-paper", [nearTwin, nearTwin]),
    ).toEqual({ imported: 1, duplicates: 1 });
  });
});

describe("mergeTrades", () => {
  it("weighted-averages entry/exit prices and sums quantity/fees/commissions", async () => {
    const a = await makeTrade({
      symbol: "MSFT",
      quantity: 100,
      avgEntryPrice: 100,
      avgExitPrice: 110,
      fees: 1,
      commissions: 1,
      netPnl: 998,
    });
    const b = await prisma.trade.create({
      data: {
        accountId,
        symbol: "MSFT",
        assetType: "stock",
        side: "long",
        status: "closed",
        openedAt: new Date("2026-01-01T09:00:00Z"),
        closedAt: new Date("2026-01-01T09:45:00Z"),
        quantity: 100,
        avgEntryPrice: 120,
        avgExitPrice: 130,
        fees: 1,
        commissions: 1,
        netPnl: 998,
      },
    });

    const result = await actions.mergeTrades([a.id, b.id]);
    expect(result.ok).toBe(true);

    const merged = await prisma.trade.findUniqueOrThrow({ where: { id: a.id } });
    expect(merged.quantity).toBe(200);
    expect(merged.avgEntryPrice).toBe(110); // (100*100 + 120*100) / 200
    expect(merged.avgExitPrice).toBe(120); // (110*100 + 130*100) / 200
    expect(merged.fees).toBe(2);
    expect(merged.commissions).toBe(2);
    // Merged span covers the earlier open and later close of the two.
    expect(merged.openedAt.toISOString()).toBe(new Date("2026-01-01T09:00:00Z").toISOString());
    expect(merged.closedAt!.toISOString()).toBe(new Date("2026-01-01T10:00:00Z").toISOString());

    expect(await prisma.trade.findUnique({ where: { id: b.id } })).toBeNull();
  });

  it("also merges each trade's executions onto the surviving trade", async () => {
    const a = await makeTrade({
      symbol: "NVDA",
      executions: {
        create: [
          { side: "buy", quantity: 10, price: 100, timestamp: new Date("2026-01-01T09:00:00Z"), isEntry: true },
        ],
      },
    });
    const b = await prisma.trade.create({
      data: {
        accountId,
        symbol: "NVDA",
        assetType: "stock",
        side: "long",
        status: "closed",
        openedAt: new Date("2026-01-01T09:05:00Z"),
        closedAt: new Date("2026-01-01T09:50:00Z"),
        quantity: 10,
        avgEntryPrice: 105,
        avgExitPrice: 115,
        netPnl: 100,
        executions: {
          create: [
            { side: "buy", quantity: 10, price: 105, timestamp: new Date("2026-01-01T09:05:00Z"), isEntry: true },
          ],
        },
      },
    });

    await actions.mergeTrades([a.id, b.id]);

    const executions = await prisma.execution.findMany({ where: { tradeId: a.id } });
    expect(executions).toHaveLength(2);
  });

  it("returns a typed error for fewer than two trades, without deleting anything", async () => {
    const a = await makeTrade({ symbol: "SOLO" });
    const result = await actions.mergeTrades([a.id]);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("at least two") });
    expect(await prisma.trade.findUnique({ where: { id: a.id } })).not.toBeNull();
  });

  it("returns a typed error when trades don't share account/symbol/side", async () => {
    const a = await makeTrade({ symbol: "ONE" });
    const b = await makeTrade({ symbol: "TWO" });
    const result = await actions.mergeTrades([a.id, b.id]);
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("same account, symbol, and side"),
    });
    // Neither trade should have been touched.
    expect(await prisma.trade.findUnique({ where: { id: a.id } })).not.toBeNull();
    expect(await prisma.trade.findUnique({ where: { id: b.id } })).not.toBeNull();
  });
});
