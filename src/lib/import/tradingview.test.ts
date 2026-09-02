import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import type { ImportFile } from "./common";
import {
  aggregateTradingViewPaper,
  classifyTradingViewFile,
  isBalanceHistory,
  isOrderHistory,
  isPositions,
} from "./tradingview";
import { detectAggregateFormat } from "./csv";

const csv = (name: string, text: string): ImportFile => {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  return { name, headers: parsed.meta.fields ?? [], rows: parsed.data };
};
const local = (s: string) => new Date(s).toISOString();

// Shape copied from real exports (paper-trading-*.csv), newest first
// like TradingView writes them. The window opens with a long already
// on from before the export, which is the normal case since the order
// history is capped at the most recent orders.
const ORDERS = csv(
  "paper-trading-order-history-all.csv",
  `
Symbol,Side,Type,Quantity,Limit price,Stop price,Fill price,Status,Commission,Placing time,Closing time,Order ID,Level ID,Leverage,Margin
CME_MINI:MNQ1!,Sell,Market,1,,,29080,Filled,,2026-09-01 20:57:21,2026-09-01 20:57:21,3479743884,,20x,"2,908.00 USD"
CME_MINI:MNQ1!,Buy,Take Profit,1,29198.5,,29198.25,Filled,,2026-09-01 16:11:15,2026-09-01 19:00:03,3479008610,,,
CME_MINI:MNQ1!,Buy,Limit,1,29187,,,Cancelled,,2026-09-01 03:30:00,2026-09-01 03:31:00,3475315238,,,
CME_MINI:MNQ1!,Sell,Market,1,,,29198.5,Filled,,2026-09-01 03:26:27,2026-09-01 03:26:27,3475326289,,20x,"2,919.85 USD"
CME_MINI:MNQ1!,Buy,Market,1,,,29195.5,Filled,,2026-09-01 03:26:23,2026-09-01 03:26:23,3475326112,,20x,"2,919.55 USD"
CME_MINI:MNQ1!,Sell,Market,1,,,29203,Filled,,2026-09-01 03:22:35,2026-09-01 03:22:35,3475315237,,20x,"2,920.30 USD"
CME_MINI:MNQ1!,Sell,Market,1,,,29201.25,Filled,,2026-09-01 03:22:18,2026-09-01 03:22:18,3475314437,,20x,"2,920.13 USD"
`,
);

const POSITIONS = csv(
  "paper-trading-positions.csv",
  `
Symbol,Side,Quantity,Avg fill price,Take profit,Stop loss,Last price,Unrealized PnL (value),Unrealized PnL (currency),Unrealized PnL %,Trade value,Market value,Leverage,Margin,Expiration date
CME_MINI:MNQ1!,Short,1,29080,29077,,29081.25,-2.5,USD,0.00%,"58,160.00 USD","58,157.50 USD",20x,"2,907.88 USD",
`,
);

const BALANCE = csv(
  "paper-trading-balance-history.csv",
  `
Time,Balance before,Balance after,Realized PnL (value),Realized PnL (currency),Action
2026-09-01 19:00:03,6294.7,6295.2,0.5,USD,"Close short position for symbol CME_MINI:MNQ1! at price 29198.25 for 1 units. Position AVG Price was 29198.500000, currency: USD, rate: 1.000000, point value: 2.000000"
2026-09-01 03:26:23,6279.7,6294.7,15,USD,"Close short position for symbol CME_MINI:MNQ1! at price 29195.50 for 1 units. Position AVG Price was 29203.000000, currency: USD, rate: 1.000000, point value: 2.000000"
2026-09-01 03:22:18,6288.7,6279.7,-9,USD,"Close long position for symbol CME_MINI:MNQ1! at price 29201.25 for 1 units. Position AVG Price was 29205.750000, currency: USD, rate: 1.000000, point value: 2.000000"
2026-08-31 21:49:42,6188.2,6214.2,26,USD,"Close long position for symbol CME_MINI:MNQ1! at price 29485.75 for 1 units. Position AVG Price was 29472.750000, currency: USD, rate: 1.000000, point value: 2.000000"
`,
);

// The two exports that carry nothing the importer needs, but that a
// user handing over "all the files" will include.
const OPEN_ORDERS = csv(
  "paper-trading-orders-all.csv",
  `
Symbol,Side,Type,Quantity,Limit price,Stop price,Fill price,Take profit,Stop loss,Instruction,Status,Placing time,Order ID,Level ID,Expiry,Leverage,Margin
CME_MINI:MNQ1!,Buy,Take Profit,1,29077,,,,,,Working,2026-09-01 20:57:34,3479744464,,2026-11-01 19:57:34,,
`,
);

const ACTIVITY = csv(
  "paper-trading-activity-log.csv",
  `
Time,Text
2026-09-01 20:57:34,Order 3479744464 successfully placed
`,
);

describe("TradingView paper trading detection", () => {
  it("recognizes each of the three useful exports", () => {
    expect(isOrderHistory(ORDERS.headers)).toBe(true);
    expect(isPositions(POSITIONS.headers)).toBe(true);
    expect(isBalanceHistory(BALANCE.headers)).toBe(true);
    expect(isOrderHistory(BALANCE.headers)).toBe(false);
  });

  it("tells the open-orders export apart from the order history despite the shared columns", () => {
    expect(isOrderHistory(OPEN_ORDERS.headers)).toBe(false);
    expect(classifyTradingViewFile(OPEN_ORDERS.headers)).toBe("open-orders");
    expect(classifyTradingViewFile(ACTIVITY.headers)).toBe("activity-log");
    expect(classifyTradingViewFile(["Symbol", "Qty", "Price"])).toBeNull();
  });

  it("is registered as an aggregate preset for any of the five files", () => {
    for (const f of [ORDERS, POSITIONS, BALANCE, OPEN_ORDERS, ACTIVITY]) {
      expect(detectAggregateFormat(f.headers)?.id).toBe("tradingview-paper");
    }
  });
});

describe("aggregateTradingViewPaper with everything the export produced", () => {
  it("uses the three that matter, ignores the rest, and says which is which", () => {
    // Deliberately in an unhelpful order: the ignorable ones first.
    const r = aggregateTradingViewPaper([ACTIVITY, OPEN_ORDERS, BALANCE, ORDERS, POSITIONS]);
    expect(r.trades.map((t) => t.netPnl)).toEqual([15, 0.5]);
    expect(r.suggestedAssetType).toBe("futures");
    expect(r.files).toEqual([
      { name: ACTIVITY.name, role: "Activity log", used: false, note: "not needed — ignored" },
      { name: OPEN_ORDERS.name, role: "Open orders", used: false, note: "not needed — ignored" },
      { name: BALANCE.name, role: "Balance history", used: true, note: "4 closes to verify against" },
      { name: ORDERS.name, role: "Order history", used: true, note: "6 fills" },
      { name: POSITIONS.name, role: "Positions", used: true, note: "1 open" },
    ]);
  });

  it("labels a file that isn't from TradingView at all", () => {
    const stray = csv("random.csv", "Symbol,Qty,Price\nAAPL,1,2\n");
    const r = aggregateTradingViewPaper([ORDERS, POSITIONS, stray]);
    expect(r.trades).toHaveLength(2);
    expect(r.files?.find((f) => f.name === "random.csv")).toMatchObject({ role: "Unrecognized", used: false });
  });

  it("merges overlapping exports of the same kind without double counting", () => {
    // An earlier export whose window overlaps the later one: the two
    // early fills appear in both, and its positions snapshot is stale.
    const earlierOrders = csv(
      "paper-trading-order-history-all-2026-09-01T03_27_00.000Z.csv",
      ORDERS.headers.join(",") + "\n" + ORDERS.rows.slice(3).map((r) => ORDERS.headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")).join("\n"),
    );
    const earlierPositions = csv(
      "paper-trading-positions-2026-09-01T03_27_00.000Z.csv",
      POSITIONS.headers.join(",") + "\nCME_MINI:MNQ1!,Short,1,29198.5,,,29198,1,USD,0.00%,x,x,20x,x,\n",
    );
    const laterOrders = { ...ORDERS, name: "paper-trading-order-history-all-2026-09-02T02_58_23.667Z.csv" };
    const laterPositions = { ...POSITIONS, name: "paper-trading-positions-2026-09-02T02_58_23.656Z.csv" };

    const r = aggregateTradingViewPaper([earlierOrders, earlierPositions, laterOrders, laterPositions, BALANCE]);
    expect(r.errors).toEqual([]);
    expect(r.trades.map((t) => t.netPnl)).toEqual([15, 0.5]);
    expect((r.warnings ?? []).some((w) => w.includes("doesn't match"))).toBe(false);
    expect(r.files?.find((f) => f.name === earlierPositions.name)).toMatchObject({
      used: false,
      note: "older snapshot — the most recent one is used",
    });
  });
});

describe("aggregateTradingViewPaper", () => {
  it("with all three files, pairs fills exactly and verifies against TradingView's P&L", () => {
    const r = aggregateTradingViewPaper([ORDERS, POSITIONS, BALANCE]);

    expect(r.errors).toEqual([]);
    expect(r.suggestedAssetType).toBe("futures");
    expect(r.trades).toHaveLength(2);
    expect(r.trades[0]).toMatchObject({
      symbol: "MNQ",
      side: "short",
      quantity: 1,
      multiplier: 2,
      avgEntryPrice: 29203,
      avgExitPrice: 29195.5,
      openedAt: local("2026-09-01 03:22:35"),
      closedAt: local("2026-09-01 03:26:23"),
      netPnl: 15,
    });
    // A filled take-profit order fills at its closing time, not when it was placed.
    expect(r.trades[1]).toMatchObject({
      avgEntryPrice: 29198.5,
      avgExitPrice: 29198.25,
      openedAt: local("2026-09-01 03:26:27"),
      closedAt: local("2026-09-01 19:00:03"),
      netPnl: 0.5,
    });

    const warnings = r.warnings ?? [];
    expect(warnings.some((w) => w.startsWith("1 trade was opened before the start"))).toBe(true);
    expect(warnings.some((w) => w.includes("1 short still open"))).toBe(true);
    expect(warnings.some((w) => w.includes("doesn't match"))).toBe(false);
  });

  it("with only the positions file, still seeds the starting position exactly (multiplier from the lookup table)", () => {
    const r = aggregateTradingViewPaper([ORDERS, POSITIONS]);
    expect(r.trades.map((t) => t.netPnl)).toEqual([15, 0.5]);
    expect(r.trades[0].multiplier).toBe(2);
  });

  it("with only the balance history, infers the starting position from the first close", () => {
    const r = aggregateTradingViewPaper([ORDERS, BALANCE]);
    expect(r.trades.map((t) => t.netPnl)).toEqual([15, 0.5]);
  });

  it("with only the order history, pairs from flat and warns that the start may be wrong", () => {
    const r = aggregateTradingViewPaper([ORDERS]);
    expect((r.warnings ?? []).some((w) => w.startsWith("Only the order history"))).toBe(true);
    // The pre-window long is misread as a new short, so the whole chain
    // shifts by one lot — which is exactly why the warning exists.
    expect(r.trades.map((t) => t.netPnl)).not.toEqual([15, 0.5]);
    expect((r.warnings ?? []).some((w) => w.includes("2 short still open"))).toBe(true);
  });

  it("flags a P&L mismatch when the positions file contradicts the balance history", () => {
    const flat = csv("paper-trading-positions.csv", POSITIONS.headers.join(",") + "\n");
    const r = aggregateTradingViewPaper([ORDERS, flat, BALANCE]);
    expect((r.warnings ?? []).some((w) => w.includes("doesn't match TradingView's balance history"))).toBe(true);
  });

  it("asks for the order history when only a companion file is dropped", () => {
    const r = aggregateTradingViewPaper([BALANCE]);
    expect(r.trades).toEqual([]);
    expect(r.warnings?.[0]).toMatch(/order history/);
  });

  it("skips cancelled orders", () => {
    const r = aggregateTradingViewPaper([ORDERS, POSITIONS]);
    expect(r.errors).toEqual([]);
    expect(r.trades.every((t) => t.avgExitPrice != null)).toBe(true);
  });

  it("warns and uses multiplier 1 for a futures contract it has no point value for", () => {
    const unknown = csv(
      "orders.csv",
      `
Symbol,Side,Type,Quantity,Limit price,Stop price,Fill price,Status,Commission,Placing time,Closing time,Order ID,Level ID,Leverage,Margin
CME:XYZ1!,Sell,Market,1,,,110,Filled,,2026-09-01 10:05:00,2026-09-01 10:05:00,2,,,
CME:XYZ1!,Buy,Market,1,,,100,Filled,,2026-09-01 10:00:00,2026-09-01 10:00:00,1,,,
`,
    );
    const flat = csv("positions.csv", POSITIONS.headers.join(",") + "\n");
    const r = aggregateTradingViewPaper([unknown, flat]);
    expect(r.trades[0]).toMatchObject({ symbol: "XYZ", multiplier: 1, netPnl: 10 });
    expect((r.warnings ?? []).some((w) => w.includes("No point value known"))).toBe(true);
  });

  it("carries the Commission column onto the trades", () => {
    const withFees = csv(
      "orders.csv",
      `
Symbol,Side,Type,Quantity,Limit price,Stop price,Fill price,Status,Commission,Placing time,Closing time,Order ID,Level ID,Leverage,Margin
NASDAQ:AAPL,Sell,Market,10,,,110,Filled,1.5,2026-09-01 10:05:00,2026-09-01 10:05:00,2,,,
NASDAQ:AAPL,Buy,Market,10,,,100,Filled,1.5,2026-09-01 10:00:00,2026-09-01 10:00:00,1,,,
`,
    );
    const flat = csv("positions.csv", POSITIONS.headers.join(",") + "\n");
    const r = aggregateTradingViewPaper([withFees, flat]);
    expect(r.suggestedAssetType).toBe("stock");
    expect(r.trades[0]).toMatchObject({ symbol: "AAPL", commissions: 3, netPnl: 97 });
  });
});
