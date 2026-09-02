import { computeTradeMath, resolveClosedAt, type TradeSide } from "@/lib/trade-math";
import {
  hasHeader as has,
  parseDate,
  parseNumber,
  type ImportFile,
  type ParsedTradeRow,
  type ParseResult,
} from "./common";
import { pairExecutions, type PairingExec } from "./pairing";
import { aggregateTradingViewPaper, isTradingViewPaperFile } from "./tradingview";

export type { FileRole, ImportFile, ParsedTradeRow, ParseResult } from "./common";

export type ColumnMapping = {
  symbol: string;
  quantity: string;
  entryPrice: string;
  exitPrice: string | null;
  openedAt: string;
  closedAt: string | null;
  fees: string | null;
  commissions: string | null;
  side: string | null; // column to read long/short (or buy/sell) from
  defaultSide: TradeSide; // used when `side` column is null or unparseable
};

const SHORT_HINTS = ["short", "sell", "sell short", "s"];
const LONG_HINTS = ["long", "buy", "b"];

function parseSide(raw: string | undefined, fallback: TradeSide): TradeSide {
  if (!raw) return fallback;
  const v = raw.trim().toLowerCase();
  if (SHORT_HINTS.includes(v)) return "short";
  if (LONG_HINTS.includes(v)) return "long";
  return fallback;
}

/**
 * Pure transform from generic parsed CSV rows (Papa.parse header:true
 * output) + a user-confirmed column mapping into trades ready to bulk
 * insert. Row-level failures are collected as errors instead of
 * throwing, so one bad row doesn't sink the whole import.
 */
export function mapCsvRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): ParseResult {
  const trades: ParsedTradeRow[] = [];
  const errors: ParseResult["errors"] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1

    const symbol = row[mapping.symbol]?.trim().toUpperCase();
    if (!symbol) {
      errors.push({ row: rowNum, message: "Missing symbol" });
      return;
    }

    const quantity = parseNumber(row[mapping.quantity]);
    if (quantity == null || quantity <= 0) {
      errors.push({ row: rowNum, message: "Missing or invalid quantity" });
      return;
    }

    const avgEntryPrice = parseNumber(row[mapping.entryPrice]);
    if (avgEntryPrice == null) {
      errors.push({ row: rowNum, message: "Missing or invalid entry price" });
      return;
    }

    const openedAt = parseDate(row[mapping.openedAt]);
    if (!openedAt) {
      errors.push({ row: rowNum, message: "Missing or invalid open date" });
      return;
    }

    const avgExitPrice = mapping.exitPrice ? parseNumber(row[mapping.exitPrice]) : null;
    const parsedClosedAt = mapping.closedAt ? parseDate(row[mapping.closedAt]) : null;
    const closedAt = resolveClosedAt(
      new Date(openedAt),
      parsedClosedAt ? new Date(parsedClosedAt) : null,
      avgExitPrice,
    )?.toISOString() ?? null;
    const fees = (mapping.fees ? parseNumber(row[mapping.fees]) : 0) ?? 0;
    const commissions =
      (mapping.commissions ? parseNumber(row[mapping.commissions]) : 0) ?? 0;
    const side = parseSide(
      mapping.side ? row[mapping.side] : undefined,
      mapping.defaultSide,
    );

    const math = computeTradeMath({
      side,
      quantity,
      multiplier: 1,
      avgEntryPrice,
      avgExitPrice,
      fees,
      commissions,
    });

    trades.push({
      symbol,
      side,
      quantity,
      avgEntryPrice,
      avgExitPrice,
      openedAt,
      closedAt,
      fees,
      commissions,
      netPnl: math.netPnl,
      netRoi: math.netRoi,
    });
  });

  return { trades, errors };
}

export type FormatPreset = {
  id: string;
  label: string;
  /** Returns true if this file's headers look like this broker's export. */
  detect: (headers: string[]) => boolean;
  mapping: (headers: string[]) => Partial<ColumnMapping>;
};

export const FORMAT_PRESETS: FormatPreset[] = [
  {
    // MT4's classic "Trade History" statement report duplicates the
    // "Item"/"Size" and "Price" column names for entry vs exit — most
    // export paths (Excel, CSV converters) disambiguate the second
    // occurrence with a ".1" suffix, which is what this targets. MT5's
    // equivalent Positions report uses "Symbol"/"Volume" instead of
    // "Item"/"Size" but is otherwise the same shape, so both header
    // sets are accepted here rather than shipping a separate,
    // unverified MT5-only preset.
    id: "mt4",
    label: "MetaTrader 4/5 export",
    detect: (h) =>
      has(h, "Ticket") &&
      (has(h, "Item") || has(h, "Symbol")) &&
      has(h, "Type") &&
      has(h, "Profit"),
    mapping: (h) => ({
      symbol: has(h, "Item") ? "Item" : "Symbol",
      quantity: has(h, "Size") ? "Size" : "Volume",
      entryPrice: "Price",
      exitPrice: "Price.1",
      openedAt: "Open Time",
      closedAt: "Close Time",
      fees: "Swap",
      commissions: "Commission",
      side: "Type",
    }),
  },
  {
    id: "tradingview",
    label: "TradingView Strategy Tester (List of Trades)",
    detect: (h) => has(h, "Trade #") && has(h, "Signal") && has(h, "Contracts"),
    mapping: () => ({
      symbol: "Symbol",
      quantity: "Contracts",
      entryPrice: "Price",
      openedAt: "Date/Time",
      side: "Type",
    }),
  },
];

export function detectFormat(headers: string[]): FormatPreset | null {
  return FORMAT_PRESETS.find((p) => p.detect(headers)) ?? null;
}

/**
 * Formats that can't be handled by column mapping at all — thinkorswim's
 * "Account Statement" trade history is one row per *execution* (a fill),
 * not one row per completed trade: an entry and its exit are two
 * separate rows sharing no column that pairs them except symbol,
 * chronological order, and a "Pos Effect" of TO OPEN / TO CLOSE.
 * detectFormat()/mapCsvRows() assume entry+exit live on the same row,
 * so these get their own pipelines (see pairing.ts) instead of a
 * ColumnMapping. Some take several files at once (TradingView).
 */
export type AggregatePreset = {
  id: string;
  label: string;
  /** Shown in the wizard so the user knows what to drop in. */
  description: string;
  detect: (headers: string[]) => boolean;
  aggregate: (files: ImportFile[]) => ParseResult;
};

export const AGGREGATE_PRESETS: AggregatePreset[] = [
  {
    id: "thinkorswim",
    label: "thinkorswim Account Statement (Trade History)",
    description:
      "One row per fill. Entries and exits are paired FIFO by symbol using the Pos Effect column, in chronological order.",
    detect: (h) =>
      has(h, "Exec Time") && has(h, "Pos Effect") && has(h, "Side") && has(h, "Qty") && has(h, "Symbol"),
    aggregate: (files) => aggregateThinkorswimExecutions(files[0].rows),
  },
  {
    id: "tradingview-paper",
    label: "TradingView Paper Trading",
    description:
      "Select every file TradingView's export gave you — they're sorted out automatically. Order history holds the fills; positions pins down what was already open when it starts; balance history verifies every P&L against TradingView's own numbers; the rest are ignored.",
    detect: isTradingViewPaperFile,
    aggregate: aggregateTradingViewPaper,
  },
];

export function detectAggregateFormat(headers: string[]): AggregatePreset | null {
  return AGGREGATE_PRESETS.find((p) => p.detect(headers)) ?? null;
}

/**
 * Pairs thinkorswim's "TO OPEN"/"TO CLOSE" executions into completed
 * trades via per-symbol FIFO matching. Options legs (calls/puts/
 * spreads) aren't specially handled beyond whatever string is in the
 * Symbol column — as long as each leg has a distinct symbol string
 * (thinkorswim's option symbols include strike/expiry), pairing is
 * still correct per-instrument; multi-leg spread P&L isn't reconciled
 * as a single combo trade.
 */
export function aggregateThinkorswimExecutions(rows: Record<string, string>[]): ParseResult {
  const errors: ParseResult["errors"] = [];
  const execs: PairingExec[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const symbol = row["Symbol"]?.trim().toUpperCase();
    const sideRaw = row["Side"]?.trim().toUpperCase();
    const posEffectRaw = row["Pos Effect"]?.trim().toUpperCase();
    const qty = parseNumber(row["Qty"]);
    const price = parseNumber(row["Price"]);
    const time = parseDate(row["Exec Time"]);

    if (!symbol) return errors.push({ row: rowNum, message: "Missing symbol" });
    if (sideRaw !== "BUY" && sideRaw !== "SELL") {
      return errors.push({ row: rowNum, message: `Unrecognized Side "${row["Side"] ?? ""}"` });
    }
    if (!posEffectRaw?.includes("OPEN") && !posEffectRaw?.includes("CLOSE")) {
      return errors.push({
        row: rowNum,
        message: `Unrecognized Pos Effect "${row["Pos Effect"] ?? ""}"`,
      });
    }
    if (qty == null || qty <= 0) return errors.push({ row: rowNum, message: "Missing or invalid Qty" });
    if (price == null) return errors.push({ row: rowNum, message: "Missing or invalid Price" });
    if (!time) return errors.push({ row: rowNum, message: "Missing or invalid Exec Time" });

    execs.push({
      rowNum,
      symbol,
      side: sideRaw === "BUY" ? "buy" : "sell",
      posEffect: posEffectRaw.includes("OPEN") ? "open" : "close",
      qty: Math.abs(qty),
      price,
      time,
      seq: index,
    });
  });

  const paired = pairExecutions(execs);
  return { trades: paired.trades, errors: [...errors, ...paired.errors] };
}

const FIELD_NAME_HINTS: Record<
  keyof Omit<ColumnMapping, "defaultSide">,
  string[]
> = {
  symbol: ["symbol", "ticker", "instrument", "item", "market"],
  quantity: ["quantity", "qty", "size", "shares", "contracts", "amount"],
  entryPrice: ["entry price", "entry", "buy price", "open price", "price"],
  exitPrice: ["exit price", "exit", "sell price", "close price"],
  openedAt: ["opened at", "opened", "open time", "entry date", "date opened", "date/time", "date", "open date"],
  closedAt: ["closed at", "closed", "close time", "exit date", "date closed", "close date"],
  fees: ["fees", "fee", "swap"],
  commissions: ["commissions", "commission", "comm"],
  side: ["side", "type", "direction", "action", "signal"],
};

/**
 * Best-effort column auto-mapping for files that don't match a known
 * FORMAT_PRESET, so the user isn't stuck manually mapping every field
 * for e.g. a spreadsheet they exported themselves with obvious header
 * names. Matches are case-insensitive and exact-first, falling back to
 * substring containment; never invents a mapping the headers don't
 * support.
 */
export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const guess: Partial<ColumnMapping> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  const used = new Set<number>();

  (Object.keys(FIELD_NAME_HINTS) as (keyof typeof FIELD_NAME_HINTS)[]).forEach(
    (field) => {
      const hints = FIELD_NAME_HINTS[field];
      let matchIdx: number | undefined;
      for (const hint of hints) {
        const idx = lowerHeaders.indexOf(hint);
        if (idx !== -1 && !used.has(idx)) {
          matchIdx = idx;
          break;
        }
      }
      if (matchIdx == null) {
        for (const hint of hints) {
          const idx = lowerHeaders.findIndex((h, i) => h.includes(hint) && !used.has(i));
          if (idx !== -1) {
            matchIdx = idx;
            break;
          }
        }
      }
      if (matchIdx != null) {
        used.add(matchIdx);
        (guess as Record<string, string>)[field] = headers[matchIdx];
      }
    },
  );

  return guess;
}
