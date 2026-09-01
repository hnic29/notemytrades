import { describe, expect, it } from "vitest";
import {
  bySymbol,
  byTag,
  byStrategy,
  byDayOfWeek,
  byWeek,
  byMonth,
  computeRiskMetrics,
  type ReportTrade,
} from "./grouping";

function trade(overrides: Partial<ReportTrade>): ReportTrade {
  return {
    netPnl: 100,
    openedAt: new Date("2026-01-06T14:00:00Z"), // a Tuesday
    closedAt: new Date("2026-01-06T15:00:00Z"),
    symbol: "AAPL",
    side: "long",
    assetType: "stock",
    tagNames: [],
    strategyName: null,
    stopLoss: null,
    profitTarget: null,
    avgEntryPrice: 100,
    quantity: 10,
    multiplier: 1,
    ...overrides,
  };
}

describe("bySymbol", () => {
  it("groups trades by symbol and sorts by net P&L descending", () => {
    const groups = bySymbol([
      trade({ symbol: "AAPL", netPnl: 100 }),
      trade({ symbol: "MSFT", netPnl: 300 }),
      trade({ symbol: "AAPL", netPnl: 50 }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["MSFT", "AAPL"]);
    expect(groups[1].stats.netPnl).toBe(150);
    expect(groups[1].stats.closedTrades).toBe(2);
  });
});

describe("byTag", () => {
  it("counts a multi-tagged trade in every tag bucket", () => {
    const groups = byTag([
      trade({ tagNames: ["breakout", "earnings"], netPnl: 100 }),
      trade({ tagNames: ["breakout"], netPnl: 50 }),
    ]);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.stats]));
    expect(byKey.breakout.netPnl).toBe(150);
    expect(byKey.earnings.netPnl).toBe(100);
  });

  it("excludes untagged trades entirely", () => {
    const groups = byTag([trade({ tagNames: [] })]);
    expect(groups).toEqual([]);
  });
});

describe("byStrategy", () => {
  it("buckets trades with no strategy under Unassigned", () => {
    const groups = byStrategy([
      trade({ strategyName: "Breakout", netPnl: 100 }),
      trade({ strategyName: null, netPnl: 50 }),
    ]);
    const unassigned = groups.find((g) => g.key === "Unassigned");
    expect(unassigned?.stats.netPnl).toBe(50);
  });
});

describe("byDayOfWeek", () => {
  it("labels and orders days Sunday through Saturday", () => {
    const groups = byDayOfWeek([
      trade({ closedAt: new Date("2026-01-04T12:00:00Z") }), // Sunday
      trade({ closedAt: new Date("2026-01-06T12:00:00Z") }), // Tuesday
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Sunday", "Tuesday"]);
  });
});

describe("byWeek / byMonth", () => {
  it("groups by ISO week and sorts chronologically", () => {
    const groups = byWeek([
      trade({ closedAt: new Date("2026-01-20T12:00:00Z") }),
      trade({ closedAt: new Date("2026-01-06T12:00:00Z") }),
    ]);
    expect(groups[0].key < groups[1].key).toBe(true);
  });

  it("groups by calendar month", () => {
    const groups = byMonth([
      trade({ closedAt: new Date("2026-02-01T12:00:00Z"), netPnl: 10 }),
      trade({ closedAt: new Date("2026-02-15T12:00:00Z"), netPnl: 20 }),
      trade({ closedAt: new Date("2026-03-01T12:00:00Z"), netPnl: 5 }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["2026-02", "2026-03"]);
    expect(groups[0].stats.netPnl).toBe(30);
  });
});

describe("computeRiskMetrics", () => {
  it("returns nulls when no trade has a stop loss set", () => {
    const metrics = computeRiskMetrics([trade({ stopLoss: null })]);
    expect(metrics.tradesWithRiskDefined).toBe(0);
    expect(metrics.avgRMultiple).toBeNull();
  });

  it("computes planned risk, reward:risk, and realized R-multiple", () => {
    const metrics = computeRiskMetrics([
      trade({
        avgEntryPrice: 100,
        stopLoss: 95,
        profitTarget: 110,
        quantity: 10,
        multiplier: 1,
        netPnl: 100, // exited at 110: (110-100)*10 = 100
      }),
    ]);
    // risk = (100-95)*10 = 50; reward:risk = (110-100)/(100-95) = 2
    expect(metrics.avgRiskPerTrade).toBe(50);
    expect(metrics.avgRewardToRisk).toBe(2);
    expect(metrics.avgRMultiple).toBe(2); // netPnl 100 / risk 50 = 2R
  });
});
