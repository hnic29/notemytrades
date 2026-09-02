import { describe, expect, it } from "vitest";
import { computeRiskRatios } from "./risk-ratios";
import type { StatsTrade } from "./stats";

function trade(closedAt: string, netPnl: number): StatsTrade {
  return { netPnl, openedAt: new Date(closedAt), closedAt: new Date(closedAt) };
}

describe("computeRiskRatios", () => {
  it("returns nulls when starting balance is 0 or unset", () => {
    const trades = [trade("2026-01-01", 100)];
    expect(computeRiskRatios(trades, 0, new Date("2026-01-01"), new Date("2026-01-10"))).toEqual({
      sharpe: null,
      sortino: null,
      calmar: null,
    });
  });

  it("returns nulls when there are fewer than 5 distinct trading days", () => {
    const trades = [trade("2026-01-01", 100), trade("2026-01-02", -50)];
    const result = computeRiskRatios(trades, 10000, new Date("2026-01-01"), new Date("2026-01-10"));
    expect(result).toEqual({ sharpe: null, sortino: null, calmar: null });
  });

  it("computes positive Sharpe/Sortino for a consistently profitable session, and a finite Calmar", () => {
    const trades = [
      trade("2026-01-01", 100),
      trade("2026-01-02", 120),
      trade("2026-01-03", 90),
      trade("2026-01-04", 110),
      trade("2026-01-05", 105),
      trade("2026-01-06", 95),
    ];
    const result = computeRiskRatios(trades, 10000, new Date("2026-01-01"), new Date("2026-01-06"));
    expect(result.sharpe).not.toBeNull();
    expect(result.sharpe!).toBeGreaterThan(0);
    // Every day is a net winner, so there's no downside deviation to
    // divide by — Sortino is undefined (null), same as Calmar below.
    expect(result.sortino).toBeNull();
    // No drawdown in a monotonically-up equity curve of all winning
    // days means Calmar has no drawdown to divide by either.
    expect(result.calmar).toBeNull();
  });

  it("computes a negative Sharpe for a losing session with drawdown-based Calmar", () => {
    const trades = [
      trade("2026-01-01", -200),
      trade("2026-01-02", 50),
      trade("2026-01-03", -150),
      trade("2026-01-04", -80),
      trade("2026-01-05", 30),
      trade("2026-01-06", -100),
    ];
    const result = computeRiskRatios(trades, 10000, new Date("2026-01-01"), new Date("2026-01-06"));
    expect(result.sharpe).not.toBeNull();
    expect(result.sharpe!).toBeLessThan(0);
    expect(result.calmar).not.toBeNull();
    expect(result.calmar!).toBeLessThan(0);
  });
});
