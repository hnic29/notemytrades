import type { Candle } from "@/lib/market-data/yahoo";
import type { TradeSide } from "@/lib/trade-math";

export type PendingOrderInput = {
  side: TradeSide;
  orderType: "limit" | "stop";
  triggerPrice: number;
};

export type OrderFillResult = { filled: boolean; fillPrice: number };

/**
 * Whether a pending order would fill against this candle, and at what
 * price. Yahoo's free feed has no intrabar (tick) granularity, so a
 * fill is modeled as "does the candle's range touch the trigger," with
 * the fill price gapped to the candle's open when price opens through
 * the trigger — it can't have filled exactly at triggerPrice if the
 * market already gapped past it on the open. The rule engine (AI
 * auto-backtest) reuses this same convention for take-profit/stop-loss
 * fills so both paths agree on what "filled" means.
 */
export function evaluateOrderFill(order: PendingOrderInput, candle: Candle): OrderFillResult {
  const isLong = order.side === "long";

  if (order.orderType === "limit") {
    // Limit buy (long entry): fills once price trades down to/through
    // the trigger. Limit sell (short entry): fills once price trades
    // up to/through it.
    if (isLong && candle.low <= order.triggerPrice) {
      return { filled: true, fillPrice: Math.min(order.triggerPrice, candle.open) };
    }
    if (!isLong && candle.high >= order.triggerPrice) {
      return { filled: true, fillPrice: Math.max(order.triggerPrice, candle.open) };
    }
  } else {
    // Stop buy (long breakout entry): fills once price trades up
    // through the trigger. Stop sell (short breakdown entry): fills
    // once price trades down through it.
    if (isLong && candle.high >= order.triggerPrice) {
      return { filled: true, fillPrice: Math.max(order.triggerPrice, candle.open) };
    }
    if (!isLong && candle.low <= order.triggerPrice) {
      return { filled: true, fillPrice: Math.min(order.triggerPrice, candle.open) };
    }
  }

  return { filled: false, fillPrice: 0 };
}

export type OpenTradeForBreakeven = {
  side: TradeSide;
  avgEntryPrice: number;
  stopLoss: number | null;
  autoBreakevenR: number | null;
};

/**
 * Returns the new stop price (always avgEntryPrice) once the candle's
 * favorable extreme reaches the configured R-multiple of the trade's
 * original risk (|avgEntryPrice - stopLoss|), or null if it hasn't
 * triggered, isn't configured, or the stop is already at breakeven.
 */
export function checkAutoBreakeven(trade: OpenTradeForBreakeven, candle: Candle): number | null {
  if (trade.autoBreakevenR == null || trade.stopLoss == null) return null;
  if (trade.stopLoss === trade.avgEntryPrice) return null;

  const riskPerUnit = Math.abs(trade.avgEntryPrice - trade.stopLoss);
  if (riskPerUnit <= 0) return null;

  const favorableExtreme = trade.side === "long" ? candle.high : candle.low;
  const favorableMove =
    trade.side === "long"
      ? favorableExtreme - trade.avgEntryPrice
      : trade.avgEntryPrice - favorableExtreme;

  const rMultiple = favorableMove / riskPerUnit;
  return rMultiple >= trade.autoBreakevenR ? trade.avgEntryPrice : null;
}
