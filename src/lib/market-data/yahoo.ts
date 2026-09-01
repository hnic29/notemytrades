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
