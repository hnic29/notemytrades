import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./broker-fees");
let settingsQueries: typeof import("@/lib/queries/settings");
let brokerQueries: typeof import("@/lib/queries/broker-fees");
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./broker-fees");
  settingsQueries = await import("@/lib/queries/settings");
  brokerQueries = await import("@/lib/queries/broker-fees");
}, 30000);

afterAll(() => cleanup());

describe("seedDefaultBrokerProfiles", () => {
  it("creates the researched default profiles and is idempotent", async () => {
    await actions.seedDefaultBrokerProfiles();
    const first = await brokerQueries.listBrokerProfiles();
    expect(first.length).toBeGreaterThan(10);
    expect(first.every((p) => !p.isCustom)).toBe(true);

    await actions.seedDefaultBrokerProfiles();
    const second = await brokerQueries.listBrokerProfiles();
    expect(second.length).toBe(first.length);
  });
});

describe("custom broker profiles", () => {
  it("creates, selects, and deletes a custom profile", async () => {
    const created = await actions.createCustomBrokerProfile({
      name: "My Test Broker",
      perContractFeeFutures: 0.5,
      perContractFeeOptions: null,
      perShareFeeStock: null,
      minFeePerOrder: null,
      monthlyPlatformFee: null,
      notes: null,
    });
    expect(created.isCustom).toBe(true);
    expect(created.sourceUrl).toBeNull();

    await actions.selectBrokerProfile(created.id);
    const settings = await settingsQueries.getSettings();
    expect(settings.selectedBrokerProfileId).toBe(created.id);

    await actions.deleteCustomBrokerProfile(created.id);
    const afterDelete = await settingsQueries.getSettings();
    expect(afterDelete.selectedBrokerProfileId).toBeNull();
  });

  it("refuses to edit or delete a non-custom (researched default) profile", async () => {
    const profiles = await brokerQueries.listBrokerProfiles();
    const builtin = profiles.find((p) => !p.isCustom)!;
    await expect(
      actions.updateCustomBrokerProfile(builtin.id, {
        name: builtin.name,
        perContractFeeFutures: 99,
        perContractFeeOptions: null,
        perShareFeeStock: null,
        minFeePerOrder: null,
        monthlyPlatformFee: null,
        notes: null,
      }),
    ).rejects.toThrow(/only custom/i);
    await expect(actions.deleteCustomBrokerProfile(builtin.id)).rejects.toThrow(/only custom/i);
  });
});

describe("setTaxSetAsidePct", () => {
  it("stores a clamped percentage, and null clears it", async () => {
    await actions.setTaxSetAsidePct(150);
    expect((await settingsQueries.getSettings()).taxSetAsidePct).toBe(100);

    await actions.setTaxSetAsidePct(-10);
    expect((await settingsQueries.getSettings()).taxSetAsidePct).toBe(0);

    await actions.setTaxSetAsidePct(null);
    expect((await settingsQueries.getSettings()).taxSetAsidePct).toBeNull();
  });
});
