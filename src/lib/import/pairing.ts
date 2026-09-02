import { computeTradeMath, resolveClosedAt, type TradeSide } from "@/lib/trade-math";
import type { ParsedTradeRow, ParseResult } from "./common";

export type PairingExec = {
  rowNum: number;
  symbol: string;
  side: "buy" | "sell";
  /**
   * Explicit open/close when the source says so (thinkorswim's Pos
   * Effect). Omitted → inferred from the running net position: a fill
   * against the current position closes it, anything else opens.
   */
  posEffect?: "open" | "close";
  qty: number;
  price: number;
  time: string; // ISO
  /** Tiebreak for fills sharing a timestamp (e.g. broker order id). */
  seq?: number;
  fees?: number;
  commissions?: number;
};

/**
 * A position that already existed when the export window starts. Only
 * the quantity/side/price are knowable from the data; `time` is null
 * because the opening fill isn't in the file, so trades that close a
 * seed lot are reported rather than emitted (no open time → no trade).
 */
export type SeedLot = { symbol: string; side: TradeSide; quantity: number; price: number };

type OpenLot = {
  side: TradeSide;
  quantityRemaining: number;
  originalQuantity: number;
  price: number;
  time: string | null;
  fees: number;
  commissions: number;
};

export type PairingOptions = {
  multiplierFor?: (symbol: string) => number;
  seedLots?: SeedLot[];
};

export type PairingResult = ParseResult & {
  /** Fills that closed a seed lot — real P&L, but unknown open time. */
  seedCloses: { symbol: string; side: TradeSide; quantity: number; closedAt: string; netPnl: number }[];
  /** Whatever is still open once every fill is processed. */
  openLots: Map<string, { side: TradeSide; quantity: number; price: number }[]>;
};

/**
 * Pairs a stream of fills into completed trades via per-symbol FIFO
 * matching: a closing fill consumes quantity from the oldest still-open
 * lot(s) for that symbol first, splitting into multiple output trades
 * if it spans more than one lot rather than blending entry prices.
 *
 * Fees on an opening fill ride along with its lot and are released in
 * proportion to the quantity each output trade takes from it; fees on
 * a closing fill are split the same way across the lots it closes.
 */
export function pairExecutions(execs: PairingExec[], opts: PairingOptions = {}): PairingResult {
  const trades: ParsedTradeRow[] = [];
  const errors: ParseResult["errors"] = [];
  const seedCloses: PairingResult["seedCloses"] = [];
  const multiplierFor = opts.multiplierFor ?? (() => 1);

  // Chronological order is what makes FIFO matching correct — CSV row
  // order isn't guaranteed to already be sorted this way.
  const sorted = [...execs].sort(
    (a, b) => a.time.localeCompare(b.time) || (a.seq ?? 0) - (b.seq ?? 0),
  );

  const openLotsBySymbol = new Map<string, OpenLot[]>();
  for (const seed of opts.seedLots ?? []) {
    if (seed.quantity <= 0) continue;
    const queue = openLotsBySymbol.get(seed.symbol) ?? [];
    openLotsBySymbol.set(seed.symbol, queue);
    queue.push({
      side: seed.side,
      quantityRemaining: seed.quantity,
      originalQuantity: seed.quantity,
      price: seed.price,
      time: null,
      fees: 0,
      commissions: 0,
    });
  }

  const openLot = (queue: OpenLot[], ex: PairingExec, qty: number, feeShare: number) => {
    queue.push({
      side: ex.side === "buy" ? "long" : "short",
      quantityRemaining: qty,
      originalQuantity: qty,
      price: ex.price,
      time: ex.time,
      fees: (ex.fees ?? 0) * feeShare,
      commissions: (ex.commissions ?? 0) * feeShare,
    });
  };

  for (const ex of sorted) {
    const queue = openLotsBySymbol.get(ex.symbol) ?? [];
    openLotsBySymbol.set(ex.symbol, queue);
    const fillSide: TradeSide = ex.side === "buy" ? "long" : "short";

    const inferred = ex.posEffect == null;
    const posEffect =
      ex.posEffect ?? (queue.length > 0 && queue[0].side !== fillSide ? "close" : "open");

    if (posEffect === "open") {
      openLot(queue, ex, ex.qty, 1);
      continue;
    }

    let remainingToClose = ex.qty;
    while (remainingToClose > 0) {
      const lot = queue[0];
      if (!lot) {
        if (inferred) {
          // Reversal: the fill was bigger than the position it closed,
          // so the remainder opens a new position the other way.
          openLot(queue, ex, remainingToClose, remainingToClose / ex.qty);
        } else {
          errors.push({
            row: ex.rowNum,
            message: `Closing execution for ${ex.symbol} has no matching open lot (${remainingToClose} unmatched)`,
          });
        }
        break;
      }

      const matchedQty = Math.min(lot.quantityRemaining, remainingToClose);
      const lotShare = matchedQty / lot.originalQuantity;
      const fillShare = matchedQty / ex.qty;
      const fees = lot.fees * lotShare + (ex.fees ?? 0) * fillShare;
      const commissions = lot.commissions * lotShare + (ex.commissions ?? 0) * fillShare;
      const multiplier = multiplierFor(ex.symbol);
      const math = computeTradeMath({
        side: lot.side,
        quantity: matchedQty,
        multiplier,
        avgEntryPrice: lot.price,
        avgExitPrice: ex.price,
        fees,
        commissions,
      });

      if (lot.time == null) {
        seedCloses.push({
          symbol: ex.symbol,
          side: lot.side,
          quantity: matchedQty,
          closedAt: ex.time,
          netPnl: math.netPnl,
        });
      } else {
        const closedAt =
          resolveClosedAt(new Date(lot.time), new Date(ex.time), ex.price)?.toISOString() ?? ex.time;
        trades.push({
          symbol: ex.symbol,
          side: lot.side,
          quantity: matchedQty,
          multiplier,
          avgEntryPrice: lot.price,
          avgExitPrice: ex.price,
          openedAt: lot.time,
          closedAt,
          fees,
          commissions,
          netPnl: math.netPnl,
          netRoi: math.netRoi,
        });
      }

      lot.quantityRemaining -= matchedQty;
      remainingToClose -= matchedQty;
      if (lot.quantityRemaining <= 0) queue.shift();
    }
  }

  const openLots: PairingResult["openLots"] = new Map();
  for (const [symbol, queue] of openLotsBySymbol) {
    if (queue.length === 0) continue;
    openLots.set(
      symbol,
      queue.map((l) => ({ side: l.side, quantity: l.quantityRemaining, price: l.price })),
    );
  }

  return { trades, errors, seedCloses, openLots };
}
