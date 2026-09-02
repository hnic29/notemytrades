import { describe, expect, it } from "vitest";
import { localDateKey, localDayRange, todayLocalKey } from "./date-key";

describe("localDateKey", () => {
  it("formats a local date as YYYY-MM-DD, zero-padded", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateKey(new Date(2026, 8, 2))).toBe("2026-09-02");
  });

  it("uses the Date's local calendar day, not its UTC one", () => {
    // 11:30 PM local time is still "today" locally, even though its
    // UTC representation may already be into the next calendar day.
    const lateLocal = new Date(2026, 8, 1, 23, 30, 0);
    expect(localDateKey(lateLocal)).toBe("2026-09-01");
  });
});

describe("localDayRange", () => {
  it("returns local midnight-to-midnight boundaries for a date key", () => {
    const { start, end } = localDayRange("2026-09-02");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8); // 0-indexed
    expect(start.getDate()).toBe(2);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getDate()).toBe(2);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it("round-trips with localDateKey: a Date built from the range's start keys back to the same day", () => {
    const { start } = localDayRange("2026-12-25");
    expect(localDateKey(start)).toBe("2026-12-25");
  });
});

describe("todayLocalKey", () => {
  it("matches localDateKey(new Date())", () => {
    expect(todayLocalKey()).toBe(localDateKey(new Date()));
  });
});
