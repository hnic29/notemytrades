import { fetchCandles, type Candle, type Timeframe } from "@/lib/market-data/yahoo";

export type CandleSession = {
  symbol: string;
  assetType: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
};

/**
 * Fetches and clips a session's candles to its date range. Previously
 * duplicated between the session detail page and its public share page
 * (both hardcoding assetType "stock", which silently broke crypto/forex
 * sessions) — now a single, asset-type-aware source of truth for both.
 */
export async function getSessionCandles(session: CandleSession): Promise<Candle[]> {
  const rangeDays = Math.max(
    1,
    Math.ceil((session.endDate.getTime() - session.startDate.getTime()) / 86400000) + 1,
  );
  const allCandles =
    (await fetchCandles(
      session.symbol,
      session.assetType,
      session.timeframe as Timeframe,
      rangeDays,
    )) ?? [];

  const startSec = session.startDate.getTime() / 1000;
  const endSec = session.endDate.getTime() / 1000 + 86400;
  return allCandles.filter((c) => c.time >= startSec && c.time <= endSec);
}
