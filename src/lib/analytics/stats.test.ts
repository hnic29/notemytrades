import { describe, expect, it } from "vitest";
import {
  computeDailyPnl,
  computeDayStreak,
  computeDrawdown,
  computeEquityCurve,
  computePnlDistribution,
  computeSummaryStats,
  computeTradeScore,
  type StatsTrade,
} from "./stats";

function trade(netPnl: number, closedAt: string | null, openedAt = closedAt): StatsTrade {
  return {
    netPnl,
    openedAt: new Date(openedAt ?? "2026-01-01"),
    closedAt: closedAt ? new Date(closedAt) : null,
  };
}

describe("computeSummaryStats", () => {
  it("computes win rate, profit factor, and averages", () => {
    const stats = computeSummaryStats([
      trade(100, "2026-01-01"),
      trade(-50, "2026-01-02"),
      trade(200, "2026-01-03"),
      trade(-25, "2026-01-04"),
    ]);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(2);
    expect(stats.winRate).toBe(0.5);
    expect(stats.netPnl).toBe(225);
    expect(stats.avgWin).toBe(150);
    expect(stats.avgLoss).toBe(37.5);
    expect(stats.profitFactor).toBeCloseTo(300 / 75);
  });

  it("excludes open (unclosed) trades from win/loss stats", () => {
    const stats = computeSummaryStats([trade(100, "2026-01-01"), trade(0, null)]);
    expect(stats.totalTrades).toBe(2);
    expect(stats.closedTrades).toBe(1);
  });

  it("computes a positive current streak from the most recent trades", () => {
    const stats = computeSummaryStats([
      trade(-10, "2026-01-01"),
      trade(50, "2026-01-02"),
      trade(20, "2026-01-03"),
      trade(30, "2026-01-04"),
    ]);
    expect(stats.currentStreak).toBe(3);
  });

  it("computes a negative current streak from the most recent trades", () => {
    const stats = computeSummaryStats([
      trade(50, "2026-01-01"),
      trade(-10, "2026-01-02"),
      trade(-20, "2026-01-03"),
    ]);
    expect(stats.currentStreak).toBe(-2);
  });

  it("returns null winRate and profitFactor with no closed trades", () => {
    const stats = computeSummaryStats([trade(0, null)]);
    expect(stats.winRate).toBeNull();
    expect(stats.profitFactor).toBeNull();
  });

  it("treats profit factor as null when there are wins but no losses", () => {
    const stats = computeSummaryStats([trade(100, "2026-01-01")]);
    expect(stats.profitFactor).toBeNull();
  });
});

describe("computeEquityCurve", () => {
  it("accumulates equity in chronological order regardless of input order", () => {
    const curve = computeEquityCurve(
      [trade(200, "2026-01-03"), trade(100, "2026-01-01"), trade(-50, "2026-01-02")],
      1000,
    );
    expect(curve.map((p) => p.equity)).toEqual([1000, 1100, 1050, 1250]);
  });
});

describe("computeDrawdown", () => {
  it("computes max drawdown from a peak", () => {
    const curve = [
      { date: "d1", equity: 1000 },
      { date: "d2", equity: 1200 },
      { date: "d3", equity: 900 },
      { date: "d4", equity: 1100 },
    ];
    const result = computeDrawdown(curve);
    expect(result.maxDrawdown).toBe(300);
    expect(result.maxDrawdownPct).toBeCloseTo(300 / 1200);
  });
});

describe("computeDailyPnl", () => {
  it("sums realized P&L per close date", () => {
    const map = computeDailyPnl([
      trade(100, "2026-01-01T09:00:00Z"),
      trade(-40, "2026-01-01T15:00:00Z"),
      trade(50, "2026-01-02T09:00:00Z"),
    ]);
    expect(map.get("2026-01-01")).toBe(60);
    expect(map.get("2026-01-02")).toBe(50);
  });
});

describe("computeDayStreak", () => {
  it("counts consecutive winning days ending at the most recent", () => {
    const map = new Map([
      ["2026-01-01", 100],
      ["2026-01-02", -50],
      ["2026-01-03", 200],
      ["2026-01-04", 50],
    ]);
    expect(computeDayStreak(map)).toBe(2);
  });

  it("counts consecutive losing days as negative", () => {
    const map = new Map([
      ["2026-01-01", 100],
      ["2026-01-02", -50],
      ["2026-01-03", -20],
    ]);
    expect(computeDayStreak(map)).toBe(-2);
  });

  it("returns 0 for no days", () => {
    expect(computeDayStreak(new Map())).toBe(0);
  });
});

describe("computePnlDistribution", () => {
  it("returns an empty array with no closed trades", () => {
    expect(computePnlDistribution([trade(0, null)])).toEqual([]);
  });

  it("buckets every trade exactly once", () => {
    const trades = [
      trade(-500, "2026-01-01"),
      trade(-100, "2026-01-02"),
      trade(50, "2026-01-03"),
      trade(300, "2026-01-04"),
      trade(1000, "2026-01-05"),
    ];
    const buckets = computePnlDistribution(trades, 5);
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(5);
  });

  it("puts all trades in one bucket when every value is identical", () => {
    const buckets = computePnlDistribution([trade(100, "2026-01-01"), trade(100, "2026-01-02")]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(2);
  });
});

describe("computeTradeScore", () => {
  it("returns null with fewer than 5 closed trades", () => {
    const stats = computeSummaryStats([trade(100, "2026-01-01")]);
    expect(computeTradeScore(stats)).toBeNull();
  });

  it("scores a strong track record highly", () => {
    const stats = computeSummaryStats([
      trade(300, "2026-01-01"),
      trade(300, "2026-01-02"),
      trade(300, "2026-01-03"),
      trade(300, "2026-01-04"),
      trade(-50, "2026-01-05"),
    ]);
    const score = computeTradeScore(stats);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThan(80);
  });

  it("scores a weak track record lowly", () => {
    const stats = computeSummaryStats([
      trade(-300, "2026-01-01"),
      trade(-300, "2026-01-02"),
      trade(-300, "2026-01-03"),
      trade(-300, "2026-01-04"),
      trade(50, "2026-01-05"),
    ]);
    const score = computeTradeScore(stats);
    expect(score!).toBeLessThan(30);
  });
});
