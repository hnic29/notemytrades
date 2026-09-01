export type DailyCandle = {
  time: string; // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
};

/**
 * Best-effort daily OHLC from Yahoo Finance's public chart JSON endpoint
 * — the only free, no-API-key source we have that's actually
 * server-fetchable (Stooq now gates its CSV export behind a JS
 * proof-of-work challenge that a server-side fetch can't solve). Daily
 * bars only; unofficial endpoint that can change or rate-limit without
 * notice, so every caller must treat null as "no chart", not an error.
 */
export async function fetchDailyOhlc(
  symbol: string,
  assetType: string,
): Promise<DailyCandle[] | null> {
  const yahooSymbol = toYahooSymbol(symbol, assetType);
  if (!yahooSymbol) return null;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=6mo`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NoteMyTrades/1.0)" },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps: number[] | undefined = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    if (!timestamps || !quote) return null;

    const candles: DailyCandle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      if ([open, high, low, close].some((v) => v == null)) continue;
      candles.push({
        time: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
      });
    }
    return candles.length > 0 ? candles : null;
  } catch {
    return null;
  }
}

export type Candle = { time: number; open: number; high: number; low: number; close: number };

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d";

/** Yahoo's actual limits on how far back each interval will return data
 * (approximate — enforced server-side, not by us). Shown in the UI so
 * "why is my chart empty" has an answer instead of a silent failure. */
export const TIMEFRAME_OPTIONS: { value: Timeframe; label: string; maxRangeDays: number }[] = [
  { value: "1m", label: "1 minute", maxRangeDays: 7 },
  { value: "5m", label: "5 minutes", maxRangeDays: 60 },
  { value: "15m", label: "15 minutes", maxRangeDays: 60 },
  { value: "1h", label: "1 hour", maxRangeDays: 730 },
  { value: "1d", label: "1 day", maxRangeDays: 36500 },
];

/**
 * General OHLC fetch supporting both intraday and daily bars, for
 * backtesting/replay. Separate from fetchDailyOhlc (Phase 1's trade
 * detail chart) so that feature's already-tested string-time contract
 * stays untouched; this one uses numeric unix-second timestamps, which
 * lightweight-charts needs for correct sub-day rendering.
 */
export async function fetchCandles(
  symbol: string,
  assetType: string,
  timeframe: Timeframe,
  rangeDays: number,
): Promise<Candle[] | null> {
  const yahooSymbol = toYahooSymbol(symbol, assetType);
  if (!yahooSymbol) return null;

  const option = TIMEFRAME_OPTIONS.find((t) => t.value === timeframe);
  const clampedDays = Math.min(rangeDays, option?.maxRangeDays ?? rangeDays);
  const range = clampedDays <= 7 ? "7d" : clampedDays <= 60 ? "60d" : clampedDays <= 730 ? "730d" : "max";

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${timeframe}&range=${range}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NoteMyTrades/1.0)" },
        next: { revalidate: timeframe === "1d" ? 3600 : 300 },
      },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps: number[] | undefined = result?.timestamp;
    const quote = result?.indicators?.quote?.[0];
    if (!timestamps || !quote) return null;

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      if ([open, high, low, close].some((v) => v == null)) continue;
      candles.push({ time: timestamps[i], open, high, low, close });
    }
    return candles.length > 0 ? candles : null;
  } catch {
    return null;
  }
}

function toYahooSymbol(symbol: string, assetType: string): string | null {
  const s = symbol.trim().toUpperCase();
  if (!s) return null;
  if (assetType === "stock") return s;
  if (assetType === "crypto") return `${s}-USD`;
  if (assetType === "forex" && s.length === 6) {
    return `${s.slice(0, 3)}${s.slice(3)}=X`;
  }
  return null;
}
