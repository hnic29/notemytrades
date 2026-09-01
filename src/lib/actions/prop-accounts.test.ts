import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./prop-accounts");
let prisma: typeof import("@/lib/prisma").prisma;
let cleanup: () => Promise<void>;

const baseInput = {
  accountName: "FTMO 100k",
  firmName: "FTMO",
  challengeType: "2-step",
  phase: "challenge",
  accountSize: 100000,
  profitTarget: 10000,
  maxDailyLoss: 5000,
  maxTotalDrawdown: 10000,
  startDate: "2026-01-01",
};

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./prop-accounts");
  ({ prisma } = await import("@/lib/prisma"));
}, 30000);

afterAll(() => cleanup());

describe("prop account actions", () => {
  it("createPropAccount also creates the underlying Account row with matching starting balance", async () => {
    const propAccount = await actions.createPropAccount(baseInput);
    const account = await prisma.account.findUniqueOrThrow({ where: { id: propAccount.accountId } });
    expect(account.name).toBe("FTMO 100k");
    expect(account.isPropFirm).toBe(true);
    expect(account.startingBalance).toBe(100000);
  });

  it("updatePropAccount updates both the PropAccount and its linked Account name", async () => {
    const propAccount = await actions.createPropAccount(baseInput);
    await actions.updatePropAccount(propAccount.id, {
      ...baseInput,
      accountName: "FTMO 100k Renamed",
      phase: "funded",
    });

    const updated = await prisma.propAccount.findUniqueOrThrow({ where: { id: propAccount.id } });
    const account = await prisma.account.findUniqueOrThrow({ where: { id: propAccount.accountId } });
    expect(updated.phase).toBe("funded");
    expect(account.name).toBe("FTMO 100k Renamed");
  });

  it("deletePropAccount cascades from the underlying Account delete", async () => {
    const propAccount = await actions.createPropAccount(baseInput);
    await actions.deletePropAccount(propAccount.id);

    expect(await prisma.propAccount.findUnique({ where: { id: propAccount.id } })).toBeNull();
    expect(await prisma.account.findUnique({ where: { id: propAccount.accountId } })).toBeNull();
  });

  it("setPhase updates just the phase", async () => {
    const propAccount = await actions.createPropAccount(baseInput);
    await actions.setPhase(propAccount.id, "verification");
    expect((await prisma.propAccount.findUniqueOrThrow({ where: { id: propAccount.id } })).phase).toBe(
      "verification",
    );
  });

  it("addTransaction and deleteTransaction round-trip", async () => {
    const propAccount = await actions.createPropAccount(baseInput);
    await actions.addTransaction(propAccount.id, {
      type: "fee",
      amount: -150,
      occurredAt: "2026-01-01",
      notes: "",
    });
    const [txn] = await prisma.propTransaction.findMany({ where: { propAccountId: propAccount.id } });
    expect(txn.amount).toBe(-150);

    await actions.deleteTransaction(txn.id, propAccount.id);
    expect(await prisma.propTransaction.findMany({ where: { propAccountId: propAccount.id } })).toHaveLength(0);
  });

  it("addPayout defaults status to pending, updatePayoutStatus sets paidAt only when paid", async () => {
    const propAccount = await actions.createPropAccount(baseInput);
    await actions.addPayout(propAccount.id, { amount: 5000, requestedAt: "2026-02-01" });
    const [payout] = await prisma.propPayout.findMany({ where: { propAccountId: propAccount.id } });
    expect(payout.status).toBe("pending");
    expect(payout.paidAt).toBeNull();

    await actions.updatePayoutStatus(payout.id, propAccount.id, "paid");
    const paid = await prisma.propPayout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(paid.status).toBe("paid");
    expect(paid.paidAt).not.toBeNull();

    await actions.updatePayoutStatus(payout.id, propAccount.id, "denied");
    const denied = await prisma.propPayout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(denied.status).toBe("denied");
    expect(denied.paidAt).toBeNull();
  });

  it("deletePayout removes only the given row", async () => {
    const propAccount = await actions.createPropAccount(baseInput);
    await actions.addPayout(propAccount.id, { amount: 1000, requestedAt: "2026-02-01" });
    const [payout] = await prisma.propPayout.findMany({ where: { propAccountId: propAccount.id } });
    await actions.deletePayout(payout.id, propAccount.id);
    expect(await prisma.propPayout.findMany({ where: { propAccountId: propAccount.id } })).toHaveLength(0);
  });
});
