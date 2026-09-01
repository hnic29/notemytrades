import { describe, expect, it } from "vitest";
import {
  aggregateThinkorswimExecutions,
  detectAggregateFormat,
  detectFormat,
  guessMapping,
  mapCsvRows,
  type ColumnMapping,
} from "./csv";

const baseMapping: ColumnMapping = {
  symbol: "Symbol",
  quantity: "Qty",
  entryPrice: "Entry",
  exitPrice: "Exit",
  openedAt: "Opened",
  closedAt: "Closed",
  fees: "Fees",
  commissions: "Commissions",
  side: "Side",
  defaultSide: "long",
};

describe("mapCsvRows", () => {
  it("maps a well-formed row into a trade with computed P&L", () => {
    const { trades, errors } = mapCsvRows(
      [
        {
          Symbol: "aapl",
          Qty: "100",
          Entry: "150",
          Exit: "160",
          Opened: "2026-01-05T09:30:00Z",
          Closed: "2026-01-05T10:00:00Z",
          Fees: "1",
          Commissions: "1",
          Side: "long",
        },
      ],
      baseMapping,
    );
    expect(errors).toEqual([]);
    expect(trades).toHaveLength(1);
    expect(trades[0].symbol).toBe("AAPL");
    expect(trades[0].netPnl).toBe(998); // (160-150)*100 - 2
  });

  it("parses accounting-style negative numbers in parentheses", () => {
    const { trades } = mapCsvRows(
      [
        {
          Symbol: "MSFT",
          Qty: "10",
          Entry: "$300.00",
          Exit: "$(50.00)",
          Opened: "2026-02-01",
          Closed: "",
          Fees: "",
          Commissions: "",
          Side: "short",
        },
      ],
      baseMapping,
    );
    expect(trades[0].avgExitPrice).toBe(-50);
  });

  it("collects a row-level error for a missing symbol without dropping other rows", () => {
    const { trades, errors } = mapCsvRows(
      [
        { Symbol: "", Qty: "10", Entry: "10", Opened: "2026-01-01" },
        { Symbol: "TSLA", Qty: "10", Entry: "10", Opened: "2026-01-02" },
      ],
      baseMapping,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(2);
    expect(trades).toHaveLength(1);
    expect(trades[0].symbol).toBe("TSLA");
  });

  it("falls back to defaultSide when the side column value is unrecognized", () => {
    const { trades } = mapCsvRows(
      [{ Symbol: "TSLA", Qty: "5", Entry: "100", Opened: "2026-01-01", Side: "??" }],
      { ...baseMapping, defaultSide: "short" },
    );
    expect(trades[0].side).toBe("short");
  });

  it("treats a missing or non-numeric quantity as a row error", () => {
    const { trades, errors } = mapCsvRows(
      [{ Symbol: "TSLA", Qty: "abc", Entry: "100", Opened: "2026-01-01" }],
      baseMapping,
    );
    expect(trades).toHaveLength(0);
    expect(errors[0].message).toMatch(/quantity/i);
  });
});

describe("detectFormat", () => {
  it("detects an MT4-style export (Item/Size headers)", () => {
    const preset = detectFormat(["Ticket", "Open Time", "Type", "Size", "Item", "Price", "Profit"]);
    expect(preset?.id).toBe("mt4");
    expect(preset?.mapping(["Ticket", "Open Time", "Type", "Size", "Item", "Price", "Profit"])).toMatchObject({
      symbol: "Item",
      quantity: "Size",
    });
  });

  it("detects an MT5-style export (Symbol/Volume headers)", () => {
    const headers = ["Ticket", "Open Time", "Type", "Volume", "Symbol", "Price", "Profit"];
    const preset = detectFormat(headers);
    expect(preset?.id).toBe("mt4");
    expect(preset?.mapping(headers)).toMatchObject({
      symbol: "Symbol",
      quantity: "Volume",
    });
  });

  it("detects a TradingView strategy tester export", () => {
    const preset = detectFormat(["Trade #", "Type", "Signal", "Date/Time", "Contracts", "Profit"]);
    expect(preset?.id).toBe("tradingview");
  });

  it("returns null for an unrecognized header set", () => {
    expect(detectFormat(["A", "B", "C"])).toBeNull();
  });
});

describe("detectAggregateFormat", () => {
  it("detects a thinkorswim account statement export", () => {
    const preset = detectAggregateFormat([
      "Exec Time",
      "Spread",
      "Side",
      "Qty",
      "Pos Effect",
      "Symbol",
      "Price",
      "Net Price",
    ]);
    expect(preset?.id).toBe("thinkorswim");
  });

  it("returns null for a row-per-trade format", () => {
    expect(detectAggregateFormat(["Ticket", "Item", "Type", "Size", "Price", "Profit"])).toBeNull();
  });
});

describe("aggregateThinkorswimExecutions", () => {
  it("pairs a simple TO OPEN/TO CLOSE round trip into one trade", () => {
    const { trades, errors } = aggregateThinkorswimExecutions([
      { "Exec Time": "1/5/2026 09:30:00", Side: "BUY", Qty: "100", "Pos Effect": "TO OPEN", Symbol: "AAPL", Price: "150" },
      { "Exec Time": "1/5/2026 10:00:00", Side: "SELL", Qty: "100", "Pos Effect": "TO CLOSE", Symbol: "AAPL", Price: "160" },
    ]);
    expect(errors).toEqual([]);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ symbol: "AAPL", side: "long", quantity: 100, netPnl: 1000 });
  });

  it("splits a close that spans two separate opens (FIFO) into two trades", () => {
    const { trades, errors } = aggregateThinkorswimExecutions([
      { "Exec Time": "1/5/2026 09:30:00", Side: "BUY", Qty: "50", "Pos Effect": "TO OPEN", Symbol: "MSFT", Price: "100" },
      { "Exec Time": "1/5/2026 09:31:00", Side: "BUY", Qty: "50", "Pos Effect": "TO OPEN", Symbol: "MSFT", Price: "110" },
      { "Exec Time": "1/5/2026 10:00:00", Side: "SELL", Qty: "100", "Pos Effect": "TO CLOSE", Symbol: "MSFT", Price: "120" },
    ]);
    expect(errors).toEqual([]);
    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({ avgEntryPrice: 100, quantity: 50, netPnl: 1000 });
    expect(trades[1]).toMatchObject({ avgEntryPrice: 110, quantity: 50, netPnl: 500 });
  });

  it("handles a short round trip (SELL TO OPEN, BUY TO CLOSE)", () => {
    const { trades } = aggregateThinkorswimExecutions([
      { "Exec Time": "1/5/2026 09:30:00", Side: "SELL", Qty: "20", "Pos Effect": "TO OPEN", Symbol: "TSLA", Price: "200" },
      { "Exec Time": "1/5/2026 10:00:00", Side: "BUY", Qty: "20", "Pos Effect": "TO CLOSE", Symbol: "TSLA", Price: "180" },
    ]);
    expect(trades[0]).toMatchObject({ side: "short", netPnl: 400 });
  });

  it("keeps separate symbols' open lots independent", () => {
    const { trades } = aggregateThinkorswimExecutions([
      { "Exec Time": "1/5/2026 09:30:00", Side: "BUY", Qty: "10", "Pos Effect": "TO OPEN", Symbol: "AAPL", Price: "100" },
      { "Exec Time": "1/5/2026 09:31:00", Side: "BUY", Qty: "10", "Pos Effect": "TO OPEN", Symbol: "MSFT", Price: "200" },
      { "Exec Time": "1/5/2026 10:00:00", Side: "SELL", Qty: "10", "Pos Effect": "TO CLOSE", Symbol: "AAPL", Price: "110" },
    ]);
    expect(trades).toHaveLength(1);
    expect(trades[0].symbol).toBe("AAPL");
  });

  it("reports a row error for a close with no matching open lot", () => {
    const { trades, errors } = aggregateThinkorswimExecutions([
      { "Exec Time": "1/5/2026 10:00:00", Side: "SELL", Qty: "10", "Pos Effect": "TO CLOSE", Symbol: "GME", Price: "50" },
    ]);
    expect(trades).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/no matching open lot/i);
  });

  it("reports a row error for an unrecognized Side value", () => {
    const { errors } = aggregateThinkorswimExecutions([
      { "Exec Time": "1/5/2026 09:30:00", Side: "SHORT", Qty: "10", "Pos Effect": "TO OPEN", Symbol: "AAPL", Price: "100" },
    ]);
    expect(errors[0].message).toMatch(/side/i);
  });

  it("leaves an unmatched open lot uncounted (still open, no error)", () => {
    const { trades, errors } = aggregateThinkorswimExecutions([
      { "Exec Time": "1/5/2026 09:30:00", Side: "BUY", Qty: "10", "Pos Effect": "TO OPEN", Symbol: "AAPL", Price: "100" },
    ]);
    expect(trades).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});

describe("guessMapping", () => {
  it("maps common header names to the right fields", () => {
    const guess = guessMapping([
      "Symbol",
      "Qty",
      "Side",
      "Entry",
      "Exit",
      "Opened",
      "Closed",
      "Fees",
      "Commissions",
    ]);
    expect(guess).toMatchObject({
      symbol: "Symbol",
      quantity: "Qty",
      side: "Side",
      entryPrice: "Entry",
      exitPrice: "Exit",
      openedAt: "Opened",
      closedAt: "Closed",
      fees: "Fees",
      commissions: "Commissions",
    });
  });

  it("never assigns the same header to two different fields", () => {
    const guess = guessMapping(["Date", "Symbol", "Price", "Quantity"]);
    const values = Object.values(guess);
    expect(new Set(values).size).toBe(values.length);
  });

  it("leaves a field unmapped when no header is a plausible match", () => {
    const guess = guessMapping(["Foo", "Bar"]);
    expect(guess.symbol).toBeUndefined();
  });
});
