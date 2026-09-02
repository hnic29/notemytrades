import type { TradeSide } from "@/lib/trade-math";
import { hasHeader, parseDate, parseNumber, type ImportFile, type ParseResult } from "./common";
import { getFuturesPointValue, parseTradingViewSymbol } from "./futures";
import { pairExecutions, type PairingExec, type SeedLot } from "./pairing";

/**
 * TradingView's Paper Trading panel exports several CSVs at once. Only
 * three matter here:
 *
 *  - Order history — one row per order (filled or cancelled). The fills
 *    are the trades, but there's no open/close flag, so entries and
 *    exits are inferred from the running net position. TradingView caps
 *    this export at the most recent orders, so it usually starts in the
 *    middle of a position.
 *  - Positions — what's open at export time. Working backwards from it
 *    through the fills gives the exact position at the start of the
 *    order window, which is what makes the inference above correct
 *    when the window opens mid-position.
 *  - Balance history — TradingView's own realized P&L per close, with
 *    the position's average price and the contract's point value. Used
 *    to verify every computed P&L, and as the multiplier source of
 *    truth for the symbols it mentions.
 *
 * The activity log and open-orders exports carry nothing extra.
 */

export const isOrderHistory = (h: string[]) =>
  hasHeader(h, "Symbol") &&
  hasHeader(h, "Side") &&
  hasHeader(h, "Quantity") &&
  hasHeader(h, "Fill price") &&
  hasHeader(h, "Status") &&
  hasHeader(h, "Placing time") &&
  hasHeader(h, "Order ID");

export const isBalanceHistory = (h: string[]) =>
  hasHeader(h, "Time") &&
  hasHeader(h, "Balance before") &&
  hasHeader(h, "Realized PnL (value)") &&
  hasHeader(h, "Action");

export const isPositions = (h: string[]) =>
  hasHeader(h, "Symbol") &&
  hasHeader(h, "Side") &&
  hasHeader(h, "Quantity") &&
  hasHeader(h, "Avg fill price") &&
  hasHeader(h, "Unrealized PnL (value)");

export const isTradingViewPaperFile = (h: string[]) =>
  isOrderHistory(h) || isBalanceHistory(h) || isPositions(h);

type BalanceClose = {
  rowNum: number;
  symbol: string; // normalized
  side: TradeSide;
  qty: number;
  price: number;
  avgPrice: number;
  pointValue: number | null;
  realizedPnl: number;
  time: string; // ISO
};

const CLOSE_ACTION =
  /^Close (long|short) position for symbol (\S+) at price ([\d.,]+) for ([\d.,]+) units\. Position AVG Price was ([\d.,]+)(?:.*?point value: ([\d.,]+))?/i;

function parseBalanceCloses(file: ImportFile): { closes: BalanceClose[]; errors: ParseResult["errors"] } {
  const closes: BalanceClose[] = [];
  const errors: ParseResult["errors"] = [];
  file.rows.forEach((row, index) => {
    const rowNum = index + 2;
    const action = row["Action"] ?? "";
    const m = CLOSE_ACTION.exec(action.trim());
    // Deposits, resets, and anything else that isn't a close are simply
    // not trades — skip silently.
    if (!m) return;
    const time = parseDate(row["Time"]);
    const realizedPnl = parseNumber(row["Realized PnL (value)"]);
    const price = parseNumber(m[3]);
    const qty = parseNumber(m[4]);
    const avgPrice = parseNumber(m[5]);
    if (!time || realizedPnl == null || price == null || qty == null || avgPrice == null) {
      errors.push({ row: rowNum, message: "Unreadable balance history row" });
      return;
    }
    closes.push({
      rowNum,
      symbol: parseTradingViewSymbol(m[2]).symbol,
      side: m[1].toLowerCase() as TradeSide,
      qty,
      price,
      avgPrice,
      pointValue: m[6] ? parseNumber(m[6]) : null,
      realizedPnl,
      time,
    });
  });
  closes.sort((a, b) => a.time.localeCompare(b.time));
  return { closes, errors };
}

function parseFills(file: ImportFile): {
  execs: PairingExec[];
  errors: ParseResult["errors"];
  assetTypes: Map<string, string | null>;
} {
  const execs: PairingExec[] = [];
  const errors: ParseResult["errors"] = [];
  const assetTypes = new Map<string, string | null>();

  file.rows.forEach((row, index) => {
    const rowNum = index + 2;
    const status = row["Status"]?.trim().toLowerCase();
    if (status !== "filled") return; // cancelled / rejected / working

    const rawSymbol = row["Symbol"]?.trim();
    if (!rawSymbol) return errors.push({ row: rowNum, message: "Missing symbol" });
    const parsedSymbol = parseTradingViewSymbol(rawSymbol);
    assetTypes.set(parsedSymbol.symbol, parsedSymbol.assetType);

    const sideRaw = row["Side"]?.trim().toLowerCase();
    if (sideRaw !== "buy" && sideRaw !== "sell") {
      return errors.push({ row: rowNum, message: `Unrecognized Side "${row["Side"] ?? ""}"` });
    }
    const qty = parseNumber(row["Quantity"]);
    const price = parseNumber(row["Fill price"]);
    // A filled limit/stop order is placed earlier and filled at its
    // closing time; market orders fill on placement so both agree.
    const time = parseDate(row["Closing time"]) ?? parseDate(row["Placing time"]);
    if (qty == null || qty <= 0) return errors.push({ row: rowNum, message: "Missing or invalid Quantity" });
    if (price == null) return errors.push({ row: rowNum, message: "Missing or invalid Fill price" });
    if (!time) return errors.push({ row: rowNum, message: "Missing or invalid fill time" });

    execs.push({
      rowNum,
      symbol: parsedSymbol.symbol,
      side: sideRaw,
      qty: Math.abs(qty),
      price,
      time,
      seq: parseNumber(row["Order ID"]) ?? index,
      commissions: Math.abs(parseNumber(row["Commission"]) ?? 0),
    });
  });

  return { execs, errors, assetTypes };
}

/** Net position (buys positive) per symbol at export time, from the positions file. */
function parsePositions(file: ImportFile): Map<string, number> {
  const net = new Map<string, number>();
  for (const row of file.rows) {
    const rawSymbol = row["Symbol"]?.trim();
    const qty = parseNumber(row["Quantity"]);
    if (!rawSymbol || qty == null) continue;
    const symbol = parseTradingViewSymbol(rawSymbol).symbol;
    const signed = row["Side"]?.trim().toLowerCase() === "short" ? -Math.abs(qty) : Math.abs(qty);
    net.set(symbol, (net.get(symbol) ?? 0) + signed);
  }
  return net;
}

function windowStartPositions(
  execs: PairingExec[],
  endPositions: Map<string, number> | null,
  closes: BalanceClose[] | null,
): Map<string, { side: TradeSide; quantity: number }> {
  const bySymbol = new Map<string, PairingExec[]>();
  for (const ex of execs) {
    const list = bySymbol.get(ex.symbol) ?? [];
    list.push(ex);
    bySymbol.set(ex.symbol, list);
  }

  const starts = new Map<string, { side: TradeSide; quantity: number }>();
  for (const [symbol, fills] of bySymbol) {
    let signedStart: number | null = null;

    if (endPositions) {
      // Exact: end position minus everything that happened in between.
      const netFills = fills.reduce((sum, f) => sum + (f.side === "buy" ? f.qty : -f.qty), 0);
      signedStart = (endPositions.get(symbol) ?? 0) - netFills;
    } else if (closes) {
      // Best effort: the first close in the window tells us the side and
      // at least how big the position was, less whatever was added to
      // it inside the window before that close.
      const sorted = [...fills].sort((a, b) => a.time.localeCompare(b.time));
      const firstFillTime = sorted[0].time;
      const first = closes.find((c) => c.symbol === symbol && c.time >= firstFillTime);
      if (first) {
        const addSide = first.side === "long" ? "buy" : "sell";
        const adds = sorted
          .filter((f) => f.time < first.time && f.side === addSide)
          .reduce((sum, f) => sum + f.qty, 0);
        const qty = Math.max(0, first.qty - adds);
        signedStart = first.side === "long" ? qty : -qty;
      }
    }

    if (signedStart != null && signedStart !== 0) {
      starts.set(symbol, {
        side: signedStart > 0 ? "long" : "short",
        quantity: Math.abs(signedStart),
      });
    }
  }
  return starts;
}

/**
 * Average price of the position that existed at window start, backed
 * out of the first close's reported average and any same-side fills
 * that were blended into it before that close.
 */
function seedPrice(
  symbol: string,
  seed: { side: TradeSide; quantity: number },
  execs: PairingExec[],
  closes: BalanceClose[],
): number | null {
  const fills = execs.filter((f) => f.symbol === symbol).sort((a, b) => a.time.localeCompare(b.time));
  if (fills.length === 0) return null;
  const first = closes.find((c) => c.symbol === symbol && c.time >= fills[0].time);
  if (!first || first.side !== seed.side) return null;
  const addSide = seed.side === "long" ? "buy" : "sell";
  const adds = fills.filter((f) => f.time < first.time && f.side === addSide);
  const addQty = adds.reduce((s, f) => s + f.qty, 0);
  const addCost = adds.reduce((s, f) => s + f.qty * f.price, 0);
  const price = (first.avgPrice * (seed.quantity + addQty) - addCost) / seed.quantity;
  return Number.isFinite(price) ? price : null;
}

const fmt = (n: number) => n.toFixed(2);

export function aggregateTradingViewPaper(files: ImportFile[]): ParseResult {
  const orderFile = files.find((f) => isOrderHistory(f.headers));
  const balanceFile = files.find((f) => isBalanceHistory(f.headers));
  const positionsFile = files.find((f) => isPositions(f.headers));

  if (!orderFile) {
    return {
      trades: [],
      errors: [],
      warnings: [
        "Add the TradingView order history export (paper-trading-order-history-…csv) — the balance history and positions files only supplement it.",
      ],
    };
  }

  const { execs, errors, assetTypes } = parseFills(orderFile);
  const warnings: string[] = [];

  const balance = balanceFile ? parseBalanceCloses(balanceFile) : null;
  if (balance) errors.push(...balance.errors);
  const closes = balance?.closes ?? null;
  const endPositions = positionsFile ? parsePositions(positionsFile) : null;

  // Multipliers: TradingView's own point value beats the lookup table.
  const multipliers = new Map<string, number>();
  for (const c of closes ?? []) {
    if (c.pointValue != null && !multipliers.has(c.symbol)) multipliers.set(c.symbol, c.pointValue);
  }
  for (const [symbol, assetType] of assetTypes) {
    if (multipliers.has(symbol)) continue;
    if (assetType === "futures") {
      const root = parseTradingViewSymbol(symbol).root;
      const pv = getFuturesPointValue(root);
      if (pv == null) {
        warnings.push(
          `No point value known for futures contract ${symbol}; its P&L is computed per point (multiplier 1). Include the balance history export or edit the trades afterwards.`,
        );
      }
      multipliers.set(symbol, pv ?? 1);
    } else {
      multipliers.set(symbol, 1);
    }
  }

  const starts = windowStartPositions(execs, endPositions, closes);
  const seedLots: SeedLot[] = [];
  for (const [symbol, seed] of starts) {
    const price = closes ? seedPrice(symbol, seed, execs, closes) : null;
    seedLots.push({ symbol, side: seed.side, quantity: seed.quantity, price: price ?? 0 });
  }
  if (!endPositions && !closes && execs.length > 0) {
    warnings.push(
      "Only the order history was provided. If this export starts in the middle of an open position, the first trade (and everything after it) can pair up wrong — add the positions export from the same moment to make the starting position exact, and the balance history to verify P&L.",
    );
  }

  const paired = pairExecutions(execs, {
    multiplierFor: (symbol) => multipliers.get(symbol) ?? 1,
    seedLots,
  });
  errors.push(...paired.errors);

  if (paired.seedCloses.length > 0) {
    const detail = paired.seedCloses
      .map((s) => `${s.symbol} ${s.side} ×${s.quantity} closed ${new Date(s.closedAt).toLocaleString()}`)
      .join("; ");
    warnings.push(
      `${paired.seedCloses.length} trade${paired.seedCloses.length === 1 ? " was" : "s were"} opened before the start of this order history export and skipped (no open time available): ${detail}. Export more often so windows overlap; already-imported trades are never duplicated.`,
    );
  }

  // Verification against TradingView's own realized P&L, per symbol,
  // over the closes that fall inside the order window.
  if (closes) {
    const symbols = new Set(paired.trades.map((t) => t.symbol));
    for (const symbol of symbols) {
      const closeTimes = new Set([
        ...paired.trades.filter((t) => t.symbol === symbol).map((t) => t.closedAt!),
        ...paired.seedCloses.filter((s) => s.symbol === symbol).map((s) => s.closedAt),
      ]);
      const ours = [
        ...paired.trades.filter((t) => t.symbol === symbol),
        ...paired.seedCloses.filter((s) => s.symbol === symbol),
      ];
      const ourNet = ours.reduce((s, t) => s + t.netPnl, 0);
      const ourGross = ours.reduce(
        (s, t) => s + t.netPnl + ("fees" in t ? t.fees + t.commissions : 0),
        0,
      );
      const theirs = closes
        .filter((c) => c.symbol === symbol && closeTimes.has(c.time))
        .reduce((s, c) => s + c.realizedPnl, 0);
      const matches = Math.abs(ourNet - theirs) < 0.01 || Math.abs(ourGross - theirs) < 0.01;
      if (!matches) {
        warnings.push(
          `${symbol}: computed P&L ${fmt(ourNet)} doesn't match TradingView's balance history ${fmt(theirs)} over the same closes. The pairing may be off — check whether the positions export was taken at the same time as the order history.`,
        );
      }
    }
  }

  for (const [symbol, lots] of paired.openLots) {
    const qty = lots.reduce((s, l) => s + l.quantity, 0);
    warnings.push(`${symbol}: ${qty} ${lots[0].side} still open at the end of the export — not imported until it's closed.`);
  }

  const types = new Set([...assetTypes.values()].filter(Boolean));
  const suggestedAssetType = types.size === 1 ? [...types][0]! : undefined;

  return { trades: paired.trades, errors, warnings, suggestedAssetType };
}
