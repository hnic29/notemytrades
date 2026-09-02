import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import type { ImportFile } from "@/lib/import/common";
import { aggregateTradingViewPaper } from "@/lib/import/tradingview";
import { pickChartTarget } from "./cdp";
import type { TradingViewSnapshot } from "./snapshot";
import { snapshotToTrades } from "./sync";

// Local wall-clock → epoch, the way TradingView's CSV export writes
// times, so the fixture below is the same history as the CSV one.
const ms = (s: string) => new Date(s).getTime();
const iso = (s: string) => new Date(s).toISOString();

/**
 * The same six fills, one open short and four closes as the CSV
 * fixtures in import/tradingview.test.ts, in the shapes TradingView's
 * in-page broker returns them (captured from Desktop 3.4).
 */
const SNAPSHOT: TradingViewSnapshot = {
  broker: { id: "Paper", title: "Paper Trading" },
  account: { id: "35994932", name: "crypto_0UT", type: "demo" },
  executions: [
    { id: "2532338618", symbol: "CME_MINI:MNQ1!", price: 29080, qty: 1, side: -1, time: ms("2026-09-01 20:57:21"), commission: null, orderId: "3479743884" },
    { id: "2532100001", symbol: "CME_MINI:MNQ1!", price: 29198.25, qty: 1, side: 1, time: ms("2026-09-01 19:00:03"), commission: null, orderId: "3479008610" },
    { id: "2531000004", symbol: "CME_MINI:MNQ1!", price: 29198.5, qty: 1, side: -1, time: ms("2026-09-01 03:26:27"), commission: null, orderId: "3475326289" },
    { id: "2531000003", symbol: "CME_MINI:MNQ1!", price: 29195.5, qty: 1, side: 1, time: ms("2026-09-01 03:26:23"), commission: null, orderId: "3475326112" },
    { id: "2531000002", symbol: "CME_MINI:MNQ1!", price: 29203, qty: 1, side: -1, time: ms("2026-09-01 03:22:35"), commission: null, orderId: "3475315237" },
    { id: "2531000001", symbol: "CME_MINI:MNQ1!", price: 29201.25, qty: 1, side: -1, time: ms("2026-09-01 03:22:18"), commission: null, orderId: "3475314437" },
  ],
  positions: [{ symbol: "CME_MINI:MNQ1!", side: -1, qty: 1, avgPrice: 29080, pointValue: 2 }],
  history: [
    { before: 6294.7, after: 6295.2, time: ms("2026-09-01 19:00:03") / 1000, orderId: "3479008610", comment: "Close short position for symbol CME_MINI:MNQ1! at price 29198.25 for 1 units. Position AVG Price was 29198.500000, currency: USD, rate: 1.000000, point value: 2.000000" },
    { before: 6279.7, after: 6294.7, time: ms("2026-09-01 03:26:23") / 1000, orderId: "3475326112", comment: "Close short position for symbol CME_MINI:MNQ1! at price 29195.50 for 1 units. Position AVG Price was 29203.000000, currency: USD, rate: 1.000000, point value: 2.000000" },
    { before: 6288.7, after: 6279.7, time: ms("2026-09-01 03:22:18") / 1000, orderId: "3475314437", comment: "Close long position for symbol CME_MINI:MNQ1! at price 29201.25 for 1 units. Position AVG Price was 29205.750000, currency: USD, rate: 1.000000, point value: 2.000000" },
    { before: 6188.2, after: 6214.2, time: ms("2026-08-31 21:49:42") / 1000, orderId: "3470000000", comment: "Close long position for symbol CME_MINI:MNQ1! at price 29485.75 for 1 units. Position AVG Price was 29472.750000, currency: USD, rate: 1.000000, point value: 2.000000" },
    { before: 0, after: 5000, time: ms("2026-08-24 10:00:00") / 1000, orderId: null, comment: "Deposit 5000.00 USD" },
  ],
  pointValues: { "CME_MINI:MNQ1!": 2 },
  takenAt: ms("2026-09-01 21:00:00"),
};

const csv = (name: string, text: string): ImportFile => {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  return { name, headers: parsed.meta.fields ?? [], rows: parsed.data };
};

const CSV_FILES = [
  csv(
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
  ),
  csv(
    "paper-trading-positions.csv",
    `
Symbol,Side,Quantity,Avg fill price,Take profit,Stop loss,Last price,Unrealized PnL (value),Unrealized PnL (currency),Unrealized PnL %,Trade value,Market value,Leverage,Margin,Expiration date
CME_MINI:MNQ1!,Short,1,29080,29077,,29081.25,-2.5,USD,0.00%,"58,160.00 USD","58,157.50 USD",20x,"2,907.88 USD",
`,
  ),
  csv(
    "paper-trading-balance-history.csv",
    `
Time,Balance before,Balance after,Realized PnL (value),Realized PnL (currency),Action
2026-09-01 19:00:03,6294.7,6295.2,0.5,USD,"Close short position for symbol CME_MINI:MNQ1! at price 29198.25 for 1 units. Position AVG Price was 29198.500000, currency: USD, rate: 1.000000, point value: 2.000000"
2026-09-01 03:26:23,6279.7,6294.7,15,USD,"Close short position for symbol CME_MINI:MNQ1! at price 29195.50 for 1 units. Position AVG Price was 29203.000000, currency: USD, rate: 1.000000, point value: 2.000000"
2026-09-01 03:22:18,6288.7,6279.7,-9,USD,"Close long position for symbol CME_MINI:MNQ1! at price 29201.25 for 1 units. Position AVG Price was 29205.750000, currency: USD, rate: 1.000000, point value: 2.000000"
2026-08-31 21:49:42,6188.2,6214.2,26,USD,"Close long position for symbol CME_MINI:MNQ1! at price 29485.75 for 1 units. Position AVG Price was 29472.750000, currency: USD, rate: 1.000000, point value: 2.000000"
`,
  ),
];

describe("snapshotToTrades", () => {
  it("pairs live fills into the same trades the CSV export produces", () => {
    const live = snapshotToTrades(SNAPSHOT);
    const fromCsv = aggregateTradingViewPaper(CSV_FILES);

    expect(live.trades).toEqual(fromCsv.trades);
    expect(live.trades).toHaveLength(2);
    expect(live.fillCount).toBe(6);
    expect(live.suggestedAssetType).toBe("futures");
    expect(live.assetTypeBySymbol).toEqual({ MNQ: "futures" });
    expect(live.openSymbols).toEqual(["MNQ"]);
    expect(live.errors).toEqual([]);
  });

  it("maps sides, times and multipliers from TradingView's encoding", () => {
    const { trades } = snapshotToTrades(SNAPSHOT);
    const [first, second] = trades;
    // Sell 29203 → buy 29195.5: a short, +7.5 points × 2 = $15.
    expect(first).toMatchObject({
      symbol: "MNQ",
      side: "short",
      quantity: 1,
      multiplier: 2,
      avgEntryPrice: 29203,
      avgExitPrice: 29195.5,
      openedAt: iso("2026-09-01 03:22:35"),
      closedAt: iso("2026-09-01 03:26:23"),
      netPnl: 15,
    });
    expect(second).toMatchObject({ side: "short", avgEntryPrice: 29198.5, avgExitPrice: 29198.25, netPnl: 0.5 });
  });

  it("verifies against the account history and reports the seed close and open position", () => {
    const warnings = snapshotToTrades(SNAPSHOT).warnings ?? [];
    expect(warnings.some((w) => /doesn't match/.test(w))).toBe(false);
    expect(warnings.some((w) => /opened before the start of TradingView's execution history/.test(w))).toBe(true);
    expect(warnings.some((w) => /MNQ: 1 short still open at the moment of the sync/.test(w))).toBe(true);
  });

  it("tolerates TradingView booking a close a second after the fill", () => {
    // Seen live: three of 259 closes were stamped one second late, which
    // used to drop them from the comparison and flag a false mismatch.
    const late = (delta: number) => ({
      ...SNAPSHOT,
      history: SNAPSHOT.history!.map((h, i) => (i === 1 ? { ...h, time: h.time + delta } : h)),
    });
    const mismatch = (w: string[] | undefined) => (w ?? []).some((x) => /doesn't match/.test(x));
    expect(mismatch(snapshotToTrades(late(1)).warnings)).toBe(false);
    expect(mismatch(snapshotToTrades(late(60)).warnings)).toBe(true);
  });

  it("still pairs when the balance history isn't exposed, using the position's point value", () => {
    const { trades, warnings = [] } = snapshotToTrades({ ...SNAPSHOT, history: null });
    expect(trades).toHaveLength(2);
    expect(trades[0].multiplier).toBe(2);
    expect(trades[0].netPnl).toBe(15);
    expect(warnings.some((w) => /couldn't be double-checked/.test(w))).toBe(true);
  });

  it("falls back to symbol info point values for symbols with no position", () => {
    const { trades } = snapshotToTrades({
      ...SNAPSHOT,
      history: null,
      positions: [],
      pointValues: { "CME_MINI:MNQ1!": 2 },
      // Flat now: the last sell closed the long that the last buy opened.
      executions: [
        { id: "2", symbol: "CME_MINI:MNQ1!", price: 29090, qty: 1, side: -1, time: ms("2026-09-01 21:00:00"), commission: null, orderId: "2" },
        { id: "1", symbol: "CME_MINI:MNQ1!", price: 29080, qty: 1, side: 1, time: ms("2026-09-01 20:57:21"), commission: null, orderId: "1" },
      ],
    });
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ side: "long", multiplier: 2, netPnl: 20 });
  });

  it("skips fills it can't read without dropping the rest", () => {
    const { trades, errors } = snapshotToTrades({
      ...SNAPSHOT,
      executions: [
        ...SNAPSHOT.executions,
        { id: "x", symbol: "CME_MINI:MNQ1!", price: Number.NaN, qty: 1, side: 1, time: ms("2026-09-01 22:00:00"), commission: null, orderId: null },
      ],
    });
    expect(errors).toHaveLength(1);
    expect(trades).toHaveLength(2);
  });
});

describe("pickChartTarget", () => {
  const page = (url: string, extra: Partial<{ type: string; webSocketDebuggerUrl: string }> = {}) => ({
    id: url,
    type: "page",
    url,
    webSocketDebuggerUrl: `ws://127.0.0.1:9222/devtools/page/${url.length}`,
    ...extra,
  });

  it("prefers the chart page over other TradingView pages and ignores non-pages", () => {
    const targets = [
      { id: "w", type: "service_worker", url: "https://www.tradingview.com/chart/sw.js", webSocketDebuggerUrl: "ws://x" },
      page("https://www.tradingview.com/"),
      page("https://www.tradingview.com/chart/dIQxtMyy/"),
      page("devtools://devtools/bundled/inspector.html"),
    ];
    expect(pickChartTarget(targets)?.url).toBe("https://www.tradingview.com/chart/dIQxtMyy/");
  });

  it("falls back to any TradingView page, and to nothing when there is none", () => {
    expect(pickChartTarget([page("https://www.tradingview.com/")])?.url).toBe("https://www.tradingview.com/");
    expect(pickChartTarget([page("https://example.com/")])).toBeNull();
    expect(pickChartTarget([page("https://www.tradingview.com/chart/x/", { webSocketDebuggerUrl: undefined })])).toBeNull();
  });
});
