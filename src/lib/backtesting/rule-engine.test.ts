import { describe, expect, it } from "vitest";
import { runRuleBacktest } from "./rule-engine";
import type { BacktestRule } from "./rule-schema";
import type { Candle } from "@/lib/market-data/yahoo";

function bar(time: number, open: number, high: number, low: number, close: number): Candle {
  return { time, open, high, low, close };
}

const crossesAbove10: BacktestRule["entry"] = {
  left: { type: "price" },
  comparison: "crosses_above",
  right: { type: "value", value: 10 },
};

describe("runRuleBacktest", () => {
  it("enters on a crosses_above trigger and exits at take-profit, gap-filled to the open", () => {
    const rule: BacktestRule = {
      side: "long",
      entry: crossesAbove10,
      exit: { takeProfitPct: 5 },
      positionSizing: { type: "fixedQuantity", quantity: 10 },
    };
    const candles = [
      bar(0, 8, 8, 8, 8),
      bar(1, 9, 9, 9, 9),
      bar(2, 11, 11, 11, 11), // crosses above 10 here; entry fills at close = 11
      bar(3, 12, 12, 12, 12), // target 11.55 touched, opened through it at 12
      bar(4, 20, 20, 20, 20),
    ];

    const result = runRuleBacktest(candles, rule, 10000);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      side: "long",
      entryIndex: 2,
      entryPrice: 11,
      exitIndex: 3,
      exitReason: "takeProfit",
      quantity: 10,
    });
    expect(result.trades[0].exitPrice).toBeCloseTo(12);
  });

  it("exits at stop-loss, gap-filled to the open", () => {
    const rule: BacktestRule = {
      side: "long",
      entry: crossesAbove10,
      exit: { stopLossPct: 5 },
      positionSizing: { type: "fixedQuantity", quantity: 10 },
    };
    const candles = [
      bar(0, 8, 8, 8, 8),
      bar(1, 9, 9, 9, 9),
      bar(2, 11, 11, 11, 11), // entry at 11, stop = 10.45
      bar(3, 10, 10.2, 10, 10), // low touches the stop, opened through it at 10
    ];

    const result = runRuleBacktest(candles, rule, 10000);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("stopLoss");
    expect(result.trades[0].exitPrice).toBeCloseTo(10);
  });

  it("closes anything still open at the end of the session at the last close", () => {
    const rule: BacktestRule = {
      side: "long",
      entry: crossesAbove10,
      exit: { takeProfitPct: 50 },
      positionSizing: { type: "fixedQuantity", quantity: 5 },
    };
    const candles = [
      bar(0, 8, 8, 8, 8),
      bar(1, 9, 9, 9, 9),
      bar(2, 11, 11, 11, 11),
      bar(3, 12, 12, 12, 12),
      bar(4, 13, 13, 13, 13),
    ];

    const result = runRuleBacktest(candles, rule, 10000);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitReason).toBe("endOfSession");
    expect(result.trades[0].exitIndex).toBe(4);
    expect(result.trades[0].exitPrice).toBe(13);
  });

  it("sizes quantity from risk-% and the stop distance", () => {
    const rule: BacktestRule = {
      side: "long",
      entry: crossesAbove10,
      exit: { stopLossPct: 5 },
      positionSizing: { type: "riskPercent", percent: 1 },
    };
    const candles = [
      bar(0, 8, 8, 8, 8),
      bar(1, 9, 9, 9, 9),
      bar(2, 11, 11, 11, 11), // entry 11, stop 10.45, riskPerUnit 0.55
      bar(3, 11, 11, 11, 11),
    ];

    const result = runRuleBacktest(candles, rule, 10000);

    // riskDollars = 10000 * 1% = 100; quantity = floor(100 / 0.55) = 181
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].quantity).toBe(181);
  });

  it("produces no trades when the entry condition never fires", () => {
    const rule: BacktestRule = {
      side: "long",
      entry: crossesAbove10,
      exit: { takeProfitPct: 5 },
      positionSizing: { type: "fixedQuantity", quantity: 1 },
    };
    const candles = [bar(0, 1, 1, 1, 1), bar(1, 2, 2, 2, 2), bar(2, 3, 3, 3, 3)];

    expect(runRuleBacktest(candles, rule, 10000).trades).toHaveLength(0);
  });
});
