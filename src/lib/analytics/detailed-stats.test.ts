import { describe, expect, it } from "vitest";
import { computeDetailedStats, computeHoldTimeDistribution, type DetailedStatsTrade } from "./detailed-stats";

function trade(overrides: Partial<DetailedStatsTrade>): DetailedStatsTrade {
  return {
    netPnl: 100,
    openedAt: new Date("2026-01-01T09:00:00Z"),
    closedAt: new Date("2026-01-01T10:00:00Z"),
    fees: 1,
    commissions: 1,
    ...overrides,
  };
}

describe("computeDetailedStats", () => {
  it("computes largest win/loss", () => {
    const stats = computeDetailedStats([
      trade({ netPnl: 500 }),
      trade({ netPnl: -200, closedAt: new Date("2026-01-02T10:00:00Z"), openedAt: new Date("2026-01-02T09:00:00Z") }),
      trade({ netPnl: 100, closedAt: new Date("2026-01-03T10:00:00Z"), openedAt: new Date("2026-01-03T09:00:00Z") }),
    ]);
    expect(stats.largestWin).toBe(500);
    expect(stats.largestLoss).toBe(-200);
  });

  it("computes average hold time split by win/loss", () => {
    const stats = computeDetailedStats([
      trade({ netPnl: 100, openedAt: new Date("2026-01-01T09:00:00Z"), closedAt: new Date("2026-01-01T09:30:00Z") }), // 30 min win
      trade({ netPnl: -50, openedAt: new Date("2026-01-02T09:00:00Z"), closedAt: new Date("2026-01-02T09:10:00Z") }), // 10 min loss
    ]);
    expect(stats.avgHoldMinutesWinning).toBe(30);
    expect(stats.avgHoldMinutesLosing).toBe(10);
    expect(stats.avgHoldMinutesAll).toBe(20);
  });

  it("counts winning/losing/breakeven days and max consecutive streaks", () => {
    const stats = computeDetailedStats([
      trade({ netPnl: 100, openedAt: new Date("2026-01-01T09:00:00Z"), closedAt: new Date("2026-01-01T10:00:00Z") }),
      trade({ netPnl: 50, openedAt: new Date("2026-01-02T09:00:00Z"), closedAt: new Date("2026-01-02T10:00:00Z") }),
      trade({ netPnl: -30, openedAt: new Date("2026-01-03T09:00:00Z"), closedAt: new Date("2026-01-03T10:00:00Z") }),
      trade({ netPnl: -30, openedAt: new Date("2026-01-04T09:00:00Z"), closedAt: new Date("2026-01-04T10:00:00Z") }),
      trade({ netPnl: -30, openedAt: new Date("2026-01-05T09:00:00Z"), closedAt: new Date("2026-01-05T10:00:00Z") }),
      trade({ netPnl: 10, openedAt: new Date("2026-01-06T09:00:00Z"), closedAt: new Date("2026-01-06T10:00:00Z") }),
    ]);
    expect(stats.totalTradingDays).toBe(6);
    expect(stats.winningDays).toBe(3);
    expect(stats.losingDays).toBe(3);
    expect(stats.maxConsecutiveWinningDays).toBe(2);
    expect(stats.maxConsecutiveLosingDays).toBe(3);
  });

  it("computes best/lowest/average month", () => {
    const stats = computeDetailedStats([
      trade({ netPnl: 1000, openedAt: new Date("2026-01-15T09:00:00Z"), closedAt: new Date("2026-01-15T10:00:00Z") }),
      trade({ netPnl: -400, openedAt: new Date("2026-02-15T09:00:00Z"), closedAt: new Date("2026-02-15T10:00:00Z") }),
    ]);
    expect(stats.bestMonth).toEqual({ label: "2026-01", value: 1000 });
    expect(stats.lowestMonth).toEqual({ label: "2026-02", value: -400 });
    expect(stats.avgMonth).toBe(300);
  });

  it("sums fees and commissions across closed trades", () => {
    const stats = computeDetailedStats([
      trade({ fees: 2, commissions: 3 }),
      trade({ fees: 1, commissions: 1, openedAt: new Date("2026-01-02T09:00:00Z"), closedAt: new Date("2026-01-02T10:00:00Z") }),
    ]);
    expect(stats.totalFees).toBe(3);
    expect(stats.totalCommissions).toBe(4);
  });

  it("handles an empty trade list without dividing by zero", () => {
    const stats = computeDetailedStats([]);
    expect(stats.bestMonth).toBeNull();
    expect(stats.avgHoldMinutesAll).toBeNull();
    expect(stats.totalTradingDays).toBe(0);
    expect(stats.expectancy).toBe(0);
  });
});

describe("computeHoldTimeDistribution", () => {
  it("buckets a fast scalp trade under 1 minute", () => {
    const buckets = computeHoldTimeDistribution([
      trade({ netPnl: 20, openedAt: new Date("2026-01-01T09:00:00Z"), closedAt: new Date("2026-01-01T09:00:30Z") }),
    ]);
    const bucket = buckets.find((b) => b.label === "Under 1 min");
    expect(bucket?.count).toBe(1);
    expect(bucket?.netPnl).toBe(20);
  });

  it("buckets a multi-hour swing trade into 4+ hrs", () => {
    const buckets = computeHoldTimeDistribution([
      trade({ netPnl: -30, openedAt: new Date("2026-01-01T09:00:00Z"), closedAt: new Date("2026-01-01T14:00:00Z") }),
    ]);
    const bucket = buckets.find((b) => b.label === "4+ hrs");
    expect(bucket?.count).toBe(1);
    expect(bucket?.netPnl).toBe(-30);
  });

  it("every closed trade lands in exactly one bucket", () => {
    const trades = [
      trade({ openedAt: new Date("2026-01-01T09:00:00Z"), closedAt: new Date("2026-01-01T09:00:10Z") }),
      trade({ openedAt: new Date("2026-01-02T09:00:00Z"), closedAt: new Date("2026-01-02T09:03:00Z") }),
      trade({ openedAt: new Date("2026-01-03T09:00:00Z"), closedAt: new Date("2026-01-03T15:00:00Z") }),
    ];
    const buckets = computeHoldTimeDistribution(trades);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(3);
  });
});
