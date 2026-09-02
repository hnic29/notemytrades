import { describe, expect, it } from "vitest";
import { getFuturesPointValue, parseTradingViewSymbol } from "./futures";

describe("parseTradingViewSymbol", () => {
  it("collapses continuous futures contracts to their root", () => {
    expect(parseTradingViewSymbol("CME_MINI:MNQ1!")).toEqual({
      symbol: "MNQ",
      root: "MNQ",
      exchange: "CME_MINI",
      assetType: "futures",
    });
    expect(parseTradingViewSymbol("CME:6E2!").symbol).toBe("6E");
  });

  it("keeps a specific contract month but still knows its root", () => {
    expect(parseTradingViewSymbol("CME_MINI:ESH2026")).toMatchObject({ symbol: "ESH2026", root: "ES", assetType: "futures" });
    expect(parseTradingViewSymbol("ESH26")).toMatchObject({ root: "ES", assetType: "futures" });
  });

  it("does not mistake a stock ticker on a stock exchange for a contract month", () => {
    expect(parseTradingViewSymbol("NASDAQ:AAPL")).toEqual({
      symbol: "AAPL",
      root: "AAPL",
      exchange: "NASDAQ",
      assetType: "stock",
    });
  });

  it("classifies crypto and forex by exchange", () => {
    expect(parseTradingViewSymbol("BINANCE:BTCUSDT").assetType).toBe("crypto");
    expect(parseTradingViewSymbol("OANDA:EURUSD").assetType).toBe("forex");
  });

  it("leaves a bare, unrecognizable symbol untyped", () => {
    expect(parseTradingViewSymbol("mnq")).toEqual({ symbol: "MNQ", root: "MNQ", exchange: null, assetType: null });
  });
});

describe("getFuturesPointValue", () => {
  it("knows the common index contracts", () => {
    expect(getFuturesPointValue("MNQ")).toBe(2);
    expect(getFuturesPointValue("es")).toBe(50);
  });
  it("returns null rather than guessing", () => {
    expect(getFuturesPointValue("XYZ")).toBeNull();
  });
});
