import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./daily-notes");
let prisma: typeof import("@/lib/prisma").prisma;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./daily-notes");
  ({ prisma } = await import("@/lib/prisma"));
}, 30000);

afterAll(() => cleanup());

describe("saveDailyNote", () => {
  it("creates a new DailyNote row for a date with no existing note", async () => {
    await actions.saveDailyNote("2026-03-01", "First entry");
    const note = await prisma.dailyNote.findUnique({
      where: { date: new Date("2026-03-01T00:00:00.000Z") },
    });
    expect(note?.contentJson).toBe("First entry");
  });

  it("upserts — a second save for the same date updates in place, not duplicates", async () => {
    await actions.saveDailyNote("2026-03-02", "Draft");
    await actions.saveDailyNote("2026-03-02", "Final");

    const notes = await prisma.dailyNote.findMany({
      where: { date: new Date("2026-03-02T00:00:00.000Z") },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].contentJson).toBe("Final");
  });

  it("keeps different dates as separate rows", async () => {
    await actions.saveDailyNote("2026-03-03", "Day A");
    await actions.saveDailyNote("2026-03-04", "Day B");

    const a = await prisma.dailyNote.findUnique({ where: { date: new Date("2026-03-03T00:00:00.000Z") } });
    const b = await prisma.dailyNote.findUnique({ where: { date: new Date("2026-03-04T00:00:00.000Z") } });
    expect(a?.contentJson).toBe("Day A");
    expect(b?.contentJson).toBe("Day B");
  });
});
