import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./strategies");
let prisma: typeof import("@/lib/prisma").prisma;
let cleanup: () => Promise<void>;

async function makeTrade(strategyId: string | null = null) {
  const account = await prisma.account.create({ data: { name: "A", assetType: "mixed", currency: "USD" } });
  return prisma.trade.create({
    data: {
      accountId: account.id,
      strategyId,
      symbol: "TEST",
      assetType: "stock",
      side: "long",
      status: "closed",
      openedAt: new Date(),
      closedAt: new Date(),
      quantity: 10,
      avgEntryPrice: 100,
      avgExitPrice: 110,
      netPnl: 100,
    },
  });
}

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./strategies");
  ({ prisma } = await import("@/lib/prisma"));
}, 30000);

afterAll(() => cleanup());

describe("strategy actions", () => {
  it("createStrategy stores rules as JSON and round-trips them", async () => {
    const rules = [{ group: "Entry", rules: ["Above VWAP"] }];
    const strategy = await actions.createStrategy({ name: "ORB", assetType: null, description: "", rules });
    expect(JSON.parse(strategy.rulesJson ?? "[]")).toEqual(rules);
  });

  it("updateStrategy overwrites name/description/rules", async () => {
    const strategy = await actions.createStrategy({ name: "Old", assetType: null, description: "", rules: [] });
    const updated = await actions.updateStrategy(strategy.id, {
      name: "New",
      assetType: "stock",
      description: "desc",
      rules: [{ group: "Exit", rules: ["2R target"] }],
    });
    expect(updated.name).toBe("New");
    expect(updated.description).toBe("desc");
    expect(JSON.parse(updated.rulesJson ?? "[]")).toHaveLength(1);
  });

  it("deleteStrategy unassigns attached trades rather than orphaning them", async () => {
    const strategy = await actions.createStrategy({ name: "Doomed", assetType: null, description: "", rules: [] });
    const trade = await makeTrade(strategy.id);

    await actions.deleteStrategy(strategy.id);

    const after = await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } });
    expect(after.strategyId).toBeNull();
  });

  it("assignTradeToStrategy sets and clears strategyId", async () => {
    const strategy = await actions.createStrategy({ name: "S", assetType: null, description: "", rules: [] });
    const trade = await makeTrade();

    await actions.assignTradeToStrategy(trade.id, strategy.id);
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } })).strategyId).toBe(strategy.id);

    await actions.assignTradeToStrategy(trade.id, null);
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: trade.id } })).strategyId).toBeNull();
  });

  it("logMissedTrade uppercases the symbol", async () => {
    const strategy = await actions.createStrategy({ name: "S", assetType: null, description: "", rules: [] });
    await actions.logMissedTrade(strategy.id, { symbol: "aapl", notes: "", occurredAt: "2026-01-01" });
    const missed = await prisma.missedTrade.findMany({ where: { strategyId: strategy.id } });
    expect(missed[0].symbol).toBe("AAPL");
  });

  it("deleteMissedTrade removes only the given row", async () => {
    const strategy = await actions.createStrategy({ name: "S", assetType: null, description: "", rules: [] });
    await actions.logMissedTrade(strategy.id, { symbol: "A", notes: "", occurredAt: "2026-01-01" });
    const [missed] = await prisma.missedTrade.findMany({ where: { strategyId: strategy.id } });
    await actions.deleteMissedTrade(missed.id, strategy.id);
    expect(await prisma.missedTrade.findMany({ where: { strategyId: strategy.id } })).toHaveLength(0);
  });

  it("generateStrategyShareLink is idempotent", async () => {
    const strategy = await actions.createStrategy({ name: "S", assetType: null, description: "", rules: [] });
    const first = await actions.generateStrategyShareLink(strategy.id);
    const second = await actions.generateStrategyShareLink(strategy.id);
    expect(second).toBe(first);
  });
});
