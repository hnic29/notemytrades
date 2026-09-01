import { describe, expect, it } from "vitest";
import { computeAdherenceStreak, isDayComplete } from "./progress";

describe("computeAdherenceStreak", () => {
  it("counts consecutive passed days from the most recent backward", () => {
    const streak = computeAdherenceStreak([
      { date: "2026-01-01", passed: true },
      { date: "2026-01-02", passed: true },
      { date: "2026-01-03", passed: true },
    ]);
    expect(streak).toBe(3);
  });

  it("stops at the first failed day, regardless of input order", () => {
    const streak = computeAdherenceStreak([
      { date: "2026-01-03", passed: true },
      { date: "2026-01-01", passed: true },
      { date: "2026-01-02", passed: false },
    ]);
    expect(streak).toBe(1); // only 01-03 counts; 01-02 breaks it
  });

  it("returns 0 when the most recent day failed", () => {
    expect(computeAdherenceStreak([{ date: "2026-01-01", passed: false }])).toBe(0);
  });

  it("returns 0 for no days", () => {
    expect(computeAdherenceStreak([])).toBe(0);
  });
});

describe("isDayComplete", () => {
  it("is false when there are no active rules", () => {
    expect(isDayComplete(0, 0, 0)).toBe(false);
  });

  it("is false when not every rule was evaluated", () => {
    expect(isDayComplete(2, 2, 3)).toBe(false);
  });

  it("is false when some evaluated rules failed", () => {
    expect(isDayComplete(2, 3, 3)).toBe(false);
  });

  it("is true when every active rule was evaluated and passed", () => {
    expect(isDayComplete(3, 3, 3)).toBe(true);
  });
});
