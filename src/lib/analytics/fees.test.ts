import { describe, expect, it } from "vitest";
import { computeFeeSummary, groupFeeSummaryByPeriod, type FeeTrade } from "./fees";

const futuresProfile = {
  perContractFeeFutures: 1,
  perContractFeeOptions: 2,
  perShareFeeStock: 0.01,
};

function trade(overrides: Partial<FeeTrade> = {}): FeeTrade {
  return {
    assetType: "futures",
    quantity: 2,
    avgExitPrice: 100,
    closedAt: new Date(2026, 8, 1),
    grossPnl: 100,
    fees: 0,
    commissions: 0,
    ...overrides,
  };
}

describe("computeFeeSummary", () => {
  it("estimates fees from the broker profile when nothing is recorded", () => {
    // closed futures trade, qty 2, 2 sides -> 1 * 2 * 2 = 4
    const summary = computeFeeSummary([trade()], futuresProfile, null);
    expect(summary.grossPnl).toBe(100);
    expect(summary.totalFees).toBe(4);
    expect(summary.estimatedFeesTotal).toBe(4);
    expect(summary.netPnl).toBe(96);
    expect(summary.tradeCount).toBe(1);
    expect(summary.uncoveredTradeCount).toBe(0);
  });

  it("prefers real recorded fees over the broker estimate", () => {
    const summary = computeFeeSummary([trade({ fees: 3, commissions: 1 })], futuresProfile, null);
    expect(summary.totalFees).toBe(4);
    expect(summary.estimatedFeesTotal).toBe(0);
    expect(summary.netPnl).toBe(96);
  });

  it("charges only 1 side for a still-open position (no avgExitPrice)", () => {
    const summary = computeFeeSummary([trade({ avgExitPrice: null })], futuresProfile, null);
    expect(summary.totalFees).toBe(2); // 1 * 2 * 1 side
  });

  it("skips estimation entirely when no profile is selected", () => {
    const summary = computeFeeSummary([trade()], null, null);
    expect(summary.totalFees).toBe(0);
    expect(summary.netPnl).toBe(100);
  });

  it("flags a trade whose asset type has no rate in the selected profile", () => {
    const summary = computeFeeSummary([trade({ assetType: "forex" })], futuresProfile, null);
    expect(summary.uncoveredTradeCount).toBe(1);
    expect(summary.totalFees).toBe(0);
  });

  it("ignores still-open trades (no closedAt) entirely", () => {
    const summary = computeFeeSummary([trade({ closedAt: null })], futuresProfile, null);
    expect(summary.tradeCount).toBe(0);
    expect(summary.grossPnl).toBe(0);
  });

  it("applies the user's own tax set-aside percentage only to positive net P&L", () => {
    const winner = computeFeeSummary([trade()], futuresProfile, 25);
    expect(winner.taxSetAside).toBe(24); // 25% of 96
    expect(winner.afterTax).toBe(72);

    const loser = computeFeeSummary([trade({ grossPnl: -50 })], futuresProfile, 25);
    expect(loser.taxSetAside).toBe(0);
    expect(loser.afterTax).toBe(loser.netPnl);
  });
});

describe("groupFeeSummaryByPeriod", () => {
  it("buckets trades by local day and sorts most recent first", () => {
    const trades = [
      trade({ closedAt: new Date(2026, 8, 1), grossPnl: 10 }),
      trade({ closedAt: new Date(2026, 8, 2), grossPnl: 20 }),
    ];
    const grouped = groupFeeSummaryByPeriod(trades, null, null, "day");
    expect(grouped.map((g) => g.key)).toEqual(["2026-09-02", "2026-09-01"]);
    expect(grouped[0].summary.grossPnl).toBe(20);
  });

  it("buckets by month", () => {
    const trades = [
      trade({ closedAt: new Date(2026, 7, 15), grossPnl: 10 }),
      trade({ closedAt: new Date(2026, 8, 1), grossPnl: 20 }),
    ];
    const grouped = groupFeeSummaryByPeriod(trades, null, null, "month");
    expect(grouped.map((g) => g.key)).toEqual(["2026-09", "2026-08"]);
  });

  it("buckets by year", () => {
    const trades = [trade({ closedAt: new Date(2025, 11, 31) }), trade({ closedAt: new Date(2026, 0, 1) })];
    const grouped = groupFeeSummaryByPeriod(trades, null, null, "year");
    expect(grouped.map((g) => g.key)).toEqual(["2026", "2025"]);
  });
});
