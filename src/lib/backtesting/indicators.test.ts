import { describe, expect, it } from "vitest";
import { computeEMA, computeRSI, computeSMA } from "./indicators";
import type { Candle } from "@/lib/market-data/yahoo";

function candles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({ time: i, open: close, high: close, low: close, close }));
}

describe("computeSMA", () => {
  it("is null before the period fills, then averages the trailing window", () => {
    const sma = computeSMA(candles([1, 2, 3, 4, 5]), 3);
    expect(sma[0]).toBeNull();
    expect(sma[1]).toBeNull();
    expect(sma[2]).toBeCloseTo((1 + 2 + 3) / 3);
    expect(sma[3]).toBeCloseTo((2 + 3 + 4) / 3);
    expect(sma[4]).toBeCloseTo((3 + 4 + 5) / 3);
  });
});

describe("computeEMA", () => {
  it("seeds with the SMA of the first period, then smooths forward", () => {
    const ema = computeEMA(candles([1, 2, 3, 4, 5]), 3);
    expect(ema[0]).toBeNull();
    expect(ema[1]).toBeNull();
    expect(ema[2]).toBeCloseTo(2); // SMA(1,2,3)
    const k = 2 / 4;
    expect(ema[3]).toBeCloseTo(4 * k + 2 * (1 - k));
  });
});

describe("computeRSI", () => {
  it("is 100 when every change in the window is a gain", () => {
    const rsi = computeRSI(candles([1, 2, 3, 4, 5, 6]), 3);
    expect(rsi[0]).toBeNull();
    expect(rsi[3]).toBe(100);
  });

  it("is 0 when every change in the window is a loss", () => {
    const rsi = computeRSI(candles([6, 5, 4, 3, 2, 1]), 3);
    expect(rsi[3]).toBe(0);
  });

  it("sits at 50 for a perfectly alternating series", () => {
    const rsi = computeRSI(candles([10, 11, 10, 11, 10, 11, 10]), 2);
    expect(rsi[2]).toBeCloseTo(50, 5);
  });
});
