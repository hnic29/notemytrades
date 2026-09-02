import type { Candle } from "@/lib/market-data/yahoo";

/** Every series is aligned 1:1 with the input candles — null at any
 * index that doesn't yet have enough history to compute a value. */
export type IndicatorSeries = (number | null)[];

/** Simple moving average of closes. */
export function computeSMA(candles: Candle[], period: number): IndicatorSeries {
  const out: IndicatorSeries = new Array(candles.length).fill(null);
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average of closes, seeded with the SMA of the
 * first `period` closes (standard practice) and smoothed forward. */
export function computeEMA(candles: Candle[], period: number): IndicatorSeries {
  const out: IndicatorSeries = new Array(candles.length).fill(null);
  if (candles.length < period) return out;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].close;
  let ema = sum / period;
  out[period - 1] = ema;

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Relative Strength Index, Wilder's smoothing (the standard RSI
 * formula) — null until `period` closes' worth of change history has
 * accumulated. */
export function computeRSI(candles: Candle[], period: number): IndicatorSeries {
  const out: IndicatorSeries = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAverages(avgGain, avgLoss);
  }
  return out;
}
