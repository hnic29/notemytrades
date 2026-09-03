import type { Candle } from "@/lib/market-data/yahoo";
import type { TradeSide } from "@/lib/trade-math";
import { computeEMA, computeRSI, computeSMA, type IndicatorSeries } from "./indicators";
import type { BacktestRule, IndicatorRefValue } from "./rule-schema";

export type RuleEngineTrade = {
  side: TradeSide;
  entryIndex: number;
  entryPrice: number;
  exitIndex: number;
  exitPrice: number;
  exitReason: "takeProfit" | "stopLoss" | "endOfSession";
  quantity: number;
};

export type RuleEngineResult = { trades: RuleEngineTrade[] };

function resolveSeries(ref: IndicatorRefValue, candles: Candle[]): IndicatorSeries {
  switch (ref.type) {
    case "price":
      return candles.map((c) => c.close);
    case "ema":
      return computeEMA(candles, ref.period!);
    case "sma":
      return computeSMA(candles, ref.period!);
    case "rsi":
      return computeRSI(candles, ref.period!);
  }
}

function evaluateComparison(
  comparison: BacktestRule["entry"]["comparison"],
  leftNow: number,
  leftPrev: number,
  rightNow: number,
  rightPrev: number,
): boolean {
  switch (comparison) {
    case "greater_than":
      return leftNow > rightNow;
    case "less_than":
      return leftNow < rightNow;
    case "crosses_above":
      return leftPrev <= rightPrev && leftNow > rightNow;
    case "crosses_below":
      return leftPrev >= rightPrev && leftNow < rightNow;
  }
}

type OpenPosition = {
  entryIndex: number;
  entryPrice: number;
  quantity: number;
  stopPrice: number | null;
  targetPrice: number | null;
};

/**
 * Checks whether this candle's range touches the stop or target,
 * reusing order-engine.ts's gap-fill convention (fill gapped to the
 * candle's open when price opened through the level, since Yahoo's
 * free feed has no intrabar granularity to do better). Stop-loss is
 * checked before take-profit — if one bar's range spans both, OHLC data
 * alone can't say which happened first, so the conservative (adverse)
 * outcome is assumed, the same convention most backtesting engines use
 * for the same reason.
 */
function checkExit(
  side: TradeSide,
  pos: OpenPosition,
  candle: Candle,
): { price: number; reason: "takeProfit" | "stopLoss" } | null {
  const isLong = side === "long";

  if (pos.stopPrice != null) {
    const hit = isLong ? candle.low <= pos.stopPrice : candle.high >= pos.stopPrice;
    if (hit) {
      const price = isLong ? Math.min(pos.stopPrice, candle.open) : Math.max(pos.stopPrice, candle.open);
      return { price, reason: "stopLoss" };
    }
  }
  if (pos.targetPrice != null) {
    const hit = isLong ? candle.high >= pos.targetPrice : candle.low <= pos.targetPrice;
    if (hit) {
      const price = isLong ? Math.max(pos.targetPrice, candle.open) : Math.min(pos.targetPrice, candle.open);
      return { price, reason: "takeProfit" };
    }
  }
  return null;
}

function sizeByRisk(
  startingBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopPrice: number,
  multiplier: number,
): number {
  const riskPerUnit = Math.abs(entryPrice - stopPrice) * multiplier;
  if (riskPerUnit <= 0) return 0;
  const riskDollars = startingBalance * (riskPercent / 100);
  return Math.max(0, Math.floor(riskDollars / riskPerUnit));
}

/**
 * Pure, synchronous, single forward pass over `candles`. At most one
 * open position at a time (matches the existing manual-trading UI/
 * action constraint) — entry is only evaluated while flat, so this
 * can't pyramid or run concurrent signals. Anything still open at the
 * last candle closes at that candle's close price.
 */
export function runRuleBacktest(
  candles: Candle[],
  rule: BacktestRule,
  startingBalance: number,
  multiplier: number = 1,
): RuleEngineResult {
  const leftSeries = resolveSeries(rule.entry.left, candles);
  const rightIsValue = rule.entry.right.type === "value";
  const rightSeries = rightIsValue ? null : resolveSeries(rule.entry.right as IndicatorRefValue, candles);
  const rightValue = rightIsValue ? (rule.entry.right as { value: number }).value : null;

  const trades: RuleEngineTrade[] = [];
  let openTrade: OpenPosition | null = null;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    if (openTrade) {
      const exit = checkExit(rule.side, openTrade, candle);
      if (exit) {
        trades.push({
          side: rule.side,
          entryIndex: openTrade.entryIndex,
          entryPrice: openTrade.entryPrice,
          exitIndex: i,
          exitPrice: exit.price,
          exitReason: exit.reason,
          quantity: openTrade.quantity,
        });
        openTrade = null;
      }
      continue;
    }

    if (i === 0) continue; // cross detection needs a prior bar

    const leftNow = leftSeries[i];
    const leftPrev = leftSeries[i - 1];
    const rightNow = rightSeries ? rightSeries[i] : rightValue;
    const rightPrev = rightSeries ? rightSeries[i - 1] : rightValue;
    if (leftNow == null || leftPrev == null || rightNow == null || rightPrev == null) continue;

    const triggered = evaluateComparison(rule.entry.comparison, leftNow, leftPrev, rightNow, rightPrev);
    if (!triggered) continue;

    const direction = rule.side === "long" ? 1 : -1;
    const entryPrice = candle.close;
    const stopPrice =
      rule.exit.stopLossPct != null ? entryPrice * (1 - (direction * rule.exit.stopLossPct) / 100) : null;
    const targetPrice =
      rule.exit.takeProfitPct != null ? entryPrice * (1 + (direction * rule.exit.takeProfitPct) / 100) : null;

    const quantity =
      rule.positionSizing.type === "fixedQuantity"
        ? rule.positionSizing.quantity
        : sizeByRisk(startingBalance, rule.positionSizing.percent, entryPrice, stopPrice!, multiplier);
    if (quantity <= 0) continue;

    openTrade = { entryIndex: i, entryPrice, quantity, stopPrice, targetPrice };
  }

  if (openTrade) {
    const lastIndex = candles.length - 1;
    trades.push({
      side: rule.side,
      entryIndex: openTrade.entryIndex,
      entryPrice: openTrade.entryPrice,
      exitIndex: lastIndex,
      exitPrice: candles[lastIndex].close,
      exitReason: "endOfSession",
      quantity: openTrade.quantity,
    });
  }

  return { trades };
}
