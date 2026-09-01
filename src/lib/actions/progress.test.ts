import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./progress");
let prisma: typeof import("@/lib/prisma").prisma;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./progress");
  ({ prisma } = await import("@/lib/prisma"));
}, 30000);

afterAll(() => cleanup());

describe("progress rule actions", () => {
  it("createRule defaults active to true and stores frequency", async () => {
    const rule = await actions.createRule({
      name: "No revenge trades",
      description: "",
      frequency: "perTrade",
    });
    expect(rule.active).toBe(true);
    expect(rule.frequency).toBe("perTrade");
    expect(rule.description).toBeNull();
  });

  it("updateRule changes name/description without touching frequency or active", async () => {
    const rule = await actions.createRule({ name: "Old", description: "d1", frequency: "daily" });
    await actions.updateRule(rule.id, { name: "New", description: "d2" });
    const updated = await prisma.progressRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(updated.name).toBe("New");
    expect(updated.description).toBe("d2");
    expect(updated.frequency).toBe("daily");
  });

  it("toggleRuleActive flips active", async () => {
    const rule = await actions.createRule({ name: "R", description: "", frequency: "daily" });
    await actions.toggleRuleActive(rule.id, false);
    expect((await prisma.progressRule.findUniqueOrThrow({ where: { id: rule.id } })).active).toBe(false);
  });

  it("deleteRule cascades to its ProgressState rows", async () => {
    const rule = await actions.createRule({ name: "R", description: "", frequency: "daily" });
    await actions.setDailyState(rule.id, "2026-01-01", true);
    await actions.deleteRule(rule.id);

    const states = await prisma.progressState.findMany({ where: { ruleId: rule.id } });
    expect(states).toHaveLength(0);
  });

  it("resetRuleHistory clears states but keeps the rule", async () => {
    const rule = await actions.createRule({ name: "R", description: "", frequency: "daily" });
    await actions.setDailyState(rule.id, "2026-01-01", true);
    await actions.resetRuleHistory(rule.id);

    const states = await prisma.progressState.findMany({ where: { ruleId: rule.id } });
    expect(states).toHaveLength(0);
    expect(await prisma.progressRule.findUnique({ where: { id: rule.id } })).not.toBeNull();
  });

  it("setDailyState creates once then updates in place for the same rule+date", async () => {
    const rule = await actions.createRule({ name: "R", description: "", frequency: "daily" });
    await actions.setDailyState(rule.id, "2026-02-01", true);
    await actions.setDailyState(rule.id, "2026-02-01", false);

    const states = await prisma.progressState.findMany({
      where: { ruleId: rule.id, date: new Date("2026-02-01T00:00:00.000Z") },
    });
    expect(states).toHaveLength(1);
    expect(states[0].passed).toBe(false);
  });

  it("setTradeState keys on ruleId+tradeId independently of setDailyState's date-only rows", async () => {
    const rule = await actions.createRule({ name: "R", description: "", frequency: "perTrade" });
    await actions.setDailyState(rule.id, "2026-02-05", true);
    await actions.setTradeState(rule.id, "trade-123", "2026-02-05", false);

    const states = await prisma.progressState.findMany({ where: { ruleId: rule.id } });
    expect(states).toHaveLength(2);
    const tradeState = states.find((s) => s.tradeId === "trade-123");
    expect(tradeState?.passed).toBe(false);
  });
});
