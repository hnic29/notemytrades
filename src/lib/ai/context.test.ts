import { describe, expect, it } from "vitest";
import { buildTradingContextSummary } from "./context";
import type { ReportTrade } from "@/lib/analytics/grouping";

function trade(overrides: Partial<ReportTrade>): ReportTrade {
  return {
    netPnl: 100,
    openedAt: new Date("2026-01-01"),
    closedAt: new Date("2026-01-01"),
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
    fees: 0,
    commissions: 0,
    ...overrides,
  };
}

describe("buildTradingContextSummary", () => {
  it("reports no trades plainly instead of fabricating numbers", () => {
    const summary = buildTradingContextSummary([]);
    expect(summary).toMatch(/no closed trades/i);
  });

  it("includes closed trade count, net P&L, and win rate", () => {
    const summary = buildTradingContextSummary([
      trade({ netPnl: 100, symbol: "AAPL" }),
      trade({ netPnl: -50, symbol: "MSFT" }),
    ]);
    expect(summary).toMatch(/2 closed trades/);
    expect(summary).toMatch(/\$50\.00/); // net P&L
    expect(summary).toMatch(/50\.0%/); // win rate
  });

  it("breaks out performance by symbol and tag", () => {
    const summary = buildTradingContextSummary([
      trade({ symbol: "AAPL", tagNames: ["breakout"], netPnl: 200 }),
      trade({ symbol: "MSFT", tagNames: ["earnings"], netPnl: -100 }),
    ]);
    expect(summary).toMatch(/By symbol:.*AAPL/);
    expect(summary).toMatch(/By tag:.*breakout/);
  });

  it("omits the tag line entirely when no trades are tagged", () => {
    const summary = buildTradingContextSummary([trade({ tagNames: [] })]);
    expect(summary).not.toMatch(/By tag:/);
  });
});
