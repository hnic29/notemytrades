import { describe, expect, it } from "vitest";
import { computePropAccountMetrics } from "./prop-account";

function trade(netPnl: number, closedAt: string | null) {
  return {
    netPnl,
    openedAt: new Date(closedAt ?? "2026-01-01"),
    closedAt: closedAt ? new Date(closedAt) : null,
  };
}

describe("computePropAccountMetrics", () => {
  it("computes balance as accountSize + netPnl + transactions", () => {
    const m = computePropAccountMetrics({
      accountSize: 50000,
      trades: [trade(1000, "2026-01-01"), trade(-200, "2026-01-02")],
      transactionTotal: -150, // e.g. a challenge fee
      profitTarget: null,
      maxDailyLoss: null,
      maxTotalDrawdown: null,
      todayKey: "2026-01-05",
    });
    expect(m.netPnl).toBe(800);
    expect(m.currentBalance).toBe(50650);
  });

  it("computes profit progress against target", () => {
    const m = computePropAccountMetrics({
      accountSize: 50000,
      trades: [trade(2000, "2026-01-01")],
      transactionTotal: 0,
      profitTarget: 4000,
      maxDailyLoss: null,
      maxTotalDrawdown: null,
      todayKey: "2026-01-05",
    });
    expect(m.profitProgressPct).toBe(0.5);
  });

  it("flags a daily loss breach when today's realized P&L exceeds the limit", () => {
    const m = computePropAccountMetrics({
      accountSize: 50000,
      trades: [trade(-1200, "2026-01-05")],
      transactionTotal: 0,
      profitTarget: null,
      maxDailyLoss: 1000,
      maxTotalDrawdown: null,
      todayKey: "2026-01-05",
    });
    expect(m.todayPnl).toBe(-1200);
    expect(m.dailyLossBreached).toBe(true);
  });

  it("does not flag a daily loss breach for a prior day's loss", () => {
    const m = computePropAccountMetrics({
      accountSize: 50000,
      trades: [trade(-1200, "2026-01-04")],
      transactionTotal: 0,
      profitTarget: null,
      maxDailyLoss: 1000,
      maxTotalDrawdown: null,
      todayKey: "2026-01-05",
    });
    expect(m.dailyLossBreached).toBe(false);
  });

  it("flags a total drawdown breach", () => {
    const m = computePropAccountMetrics({
      accountSize: 50000,
      trades: [trade(2000, "2026-01-01"), trade(-3000, "2026-01-02")],
      transactionTotal: 0,
      profitTarget: null,
      maxDailyLoss: null,
      maxTotalDrawdown: 2500,
      todayKey: "2026-01-05",
    });
    expect(m.totalDrawdown).toBe(3000); // peak 52000 -> 49000
    expect(m.totalDrawdownBreached).toBe(true);
  });
});
