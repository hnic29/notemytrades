import { describe, expect, it } from "vitest";
import { averageExecutions, computeTradeMath, resolveClosedAt } from "./trade-math";

describe("computeTradeMath", () => {
  it("computes a winning long stock trade", () => {
    const result = computeTradeMath({
      side: "long",
      quantity: 100,
      multiplier: 1,
      avgEntryPrice: 10,
      avgExitPrice: 12,
      fees: 1,
      commissions: 1,
    });
    expect(result.grossPnl).toBe(200);
    expect(result.netPnl).toBe(198);
    expect(result.costBasis).toBe(1000);
    expect(result.netRoi).toBeCloseTo(0.198);
  });

  it("computes a losing short trade", () => {
    const result = computeTradeMath({
      side: "short",
      quantity: 50,
      multiplier: 1,
      avgEntryPrice: 20,
      avgExitPrice: 22,
      fees: 0,
      commissions: 0,
    });
    // price went up 2, short loses 2 * 50 = 100
    expect(result.grossPnl).toBe(-100);
    expect(result.netPnl).toBe(-100);
  });

  it("applies a futures point multiplier", () => {
    const result = computeTradeMath({
      side: "long",
      quantity: 2,
      multiplier: 50, // e.g. ES point value
      avgEntryPrice: 4500,
      avgExitPrice: 4510,
      fees: 4,
      commissions: 0,
    });
    // (4510 - 4500) * 2 * 50 = 1000
    expect(result.grossPnl).toBe(1000);
    expect(result.netPnl).toBe(996);
  });

  it("returns null netRoi and zero grossPnl for an open trade (no exit yet)", () => {
    const result = computeTradeMath({
      side: "long",
      quantity: 10,
      multiplier: 1,
      avgEntryPrice: 100,
      avgExitPrice: null,
      fees: 2,
      commissions: 3,
    });
    expect(result.grossPnl).toBe(0);
    expect(result.netPnl).toBe(-5);
    expect(result.netRoi).toBeNull();
  });

  it("handles a zero cost basis without dividing by zero", () => {
    const result = computeTradeMath({
      side: "long",
      quantity: 10,
      multiplier: 1,
      avgEntryPrice: 0,
      avgExitPrice: 1,
      fees: 0,
      commissions: 0,
    });
    expect(result.netRoi).toBeNull();
  });
});

describe("resolveClosedAt", () => {
  const opened = new Date("2026-01-01T09:30:00Z");
  const closed = new Date("2026-01-01T10:00:00Z");

  it("keeps an explicit closedAt as-is", () => {
    expect(resolveClosedAt(opened, closed, 110)).toBe(closed);
  });

  it("falls back to openedAt when an exit price is set but closedAt is missing", () => {
    expect(resolveClosedAt(opened, null, 110)).toBe(opened);
  });

  it("stays null when there's no exit price (still open)", () => {
    expect(resolveClosedAt(opened, null, null)).toBeNull();
  });
});

describe("averageExecutions", () => {
  it("weight-averages multiple entries and a single exit", () => {
    const result = averageExecutions([
      { side: "buy", quantity: 100, price: 10, isEntry: true },
      { side: "buy", quantity: 100, price: 12, isEntry: true },
      { side: "sell", quantity: 200, price: 15, isEntry: false },
    ]);
    expect(result.quantity).toBe(200);
    expect(result.avgEntryPrice).toBe(11);
    expect(result.avgExitPrice).toBe(15);
  });

  it("returns null avgExitPrice when there are no exits yet", () => {
    const result = averageExecutions([
      { side: "buy", quantity: 10, price: 5, isEntry: true },
    ]);
    expect(result.avgExitPrice).toBeNull();
  });

  it("weight-averages partial scale-out exits", () => {
    const result = averageExecutions([
      { side: "buy", quantity: 300, price: 10, isEntry: true },
      { side: "sell", quantity: 100, price: 11, isEntry: false },
      { side: "sell", quantity: 200, price: 13, isEntry: false },
    ]);
    expect(result.avgExitPrice).toBeCloseTo(12.333, 2);
  });
});
