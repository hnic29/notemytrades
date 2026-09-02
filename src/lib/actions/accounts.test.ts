import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./accounts");
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./accounts");
}, 30000);

afterAll(() => cleanup());

describe("accounts actions", () => {
  it("creates an account with the given fields and sane defaults", async () => {
    const account = await actions.createAccount({ name: "Main" });
    expect(account.name).toBe("Main");
    expect(account.assetType).toBe("mixed");
    expect(account.currency).toBe("USD");
    expect(account.startingBalance).toBe(0);
    expect(account.archived).toBe(false);
  });

  it("createAccount respects an explicit starting balance and currency", async () => {
    const account = await actions.createAccount({
      name: "Funded",
      currency: "EUR",
      startingBalance: 5000,
    });
    expect(account.currency).toBe("EUR");
    expect(account.startingBalance).toBe(5000);
  });

  it("getOrCreateDefaultAccount reuses an existing non-archived account", async () => {
    const first = await actions.getOrCreateDefaultAccount();
    const second = await actions.getOrCreateDefaultAccount();
    expect(second.id).toBe(first.id);
  });

  it("getOrCreateBacktestAccount always returns the same dedicated account", async () => {
    const first = await actions.getOrCreateBacktestAccount();
    const second = await actions.getOrCreateBacktestAccount();
    expect(second.id).toBe(first.id);
    expect(first.name).toBe("Backtesting");
  });

  it("updateAccount overwrites the given fields", async () => {
    const account = await actions.createAccount({ name: "Before" });
    const updated = await actions.updateAccount(account.id, {
      name: "After",
      broker: "Schwab",
      startingBalance: 1000,
    });
    expect(updated.name).toBe("After");
    expect(updated.broker).toBe("Schwab");
    expect(updated.startingBalance).toBe(1000);
  });

  it("setAccountArchived hides an account from listAccounts but not listAllAccounts", async () => {
    const account = await actions.createAccount({ name: "ToArchive" });
    await actions.setAccountArchived(account.id, true);

    const visible = await actions.listAccounts();
    const all = await actions.listAllAccounts();
    expect(visible.find((a) => a.id === account.id)).toBeUndefined();
    expect(all.find((a) => a.id === account.id)?.archived).toBe(true);
  });

  it("deleteAccount removes the row", async () => {
    const account = await actions.createAccount({ name: "ToDelete" });
    await actions.deleteAccount(account.id);
    const all = await actions.listAllAccounts();
    expect(all.find((a) => a.id === account.id)).toBeUndefined();
  });

  it("createAccount rejects a name that already exists, case-insensitively", async () => {
    await actions.createAccount({ name: "Duplicate Guard" });
    await expect(actions.createAccount({ name: "duplicate guard" })).rejects.toThrow(/already exists/i);
  });

  it("createAccount still blocks against an archived account with the same name", async () => {
    const archived = await actions.createAccount({ name: "Old Archived" });
    await actions.setAccountArchived(archived.id, true);
    await expect(actions.createAccount({ name: "Old Archived" })).rejects.toThrow(/already exists/i);
  });

  it("updateAccount allows keeping an account's own name, but not colliding with another", async () => {
    const a = await actions.createAccount({ name: "Keep Mine" });
    const b = await actions.createAccount({ name: "The Other One" });

    // Renaming to its own current name is a no-op, not a collision.
    await expect(actions.updateAccount(a.id, { name: "Keep Mine" })).resolves.toBeTruthy();

    // Renaming to another account's name is blocked.
    await expect(actions.updateAccount(a.id, { name: "The Other One" })).rejects.toThrow(/already exists/i);
    void b;
  });
});
