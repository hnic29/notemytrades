import { computeTradeMath, type TradeSide } from "@/lib/trade-math";

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

export type ParsedTradeRow = {
  symbol: string;
  side: TradeSide;
  quantity: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  openedAt: string; // ISO
  closedAt: string | null;
  fees: number;
  commissions: number;
  netPnl: number;
  netRoi: number | null;
};

export type ParseResult = {
  trades: ParsedTradeRow[];
  errors: { row: number; message: string }[];
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

function parseNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const isParen = /^\(.*\)$/.test(cleaned);
  const n = Number(isParen ? cleaned.slice(1, -1) : cleaned);
  if (!Number.isFinite(n)) return null;
  return isParen ? -n : n;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw || raw.trim() === "") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
    const closedAt = mapping.closedAt ? parseDate(row[mapping.closedAt]) : null;
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

const has = (headers: string[], name: string) =>
  headers.some((h) => h.trim().toLowerCase() === name.toLowerCase());

export const FORMAT_PRESETS: FormatPreset[] = [
  {
    id: "mt4",
    label: "MetaTrader 4/5 export",
    detect: (h) => has(h, "Ticket") && has(h, "Item") && has(h, "Type") && has(h, "Profit"),
    mapping: () => ({
      symbol: "Item",
      quantity: "Size",
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
