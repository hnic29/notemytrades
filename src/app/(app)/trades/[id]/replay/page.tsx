import { notFound } from "next/navigation";
import Link from "next/link";
import { getTradeById } from "@/lib/queries/trades";
import { fetchCandles, type Timeframe } from "@/lib/market-data/yahoo";
import { TradeReplay } from "@/components/backtesting/TradeReplay";

function pickTimeframe(openedAt: Date): { timeframe: Timeframe; rangeDays: number } {
  const ageDays = (Date.now() - openedAt.getTime()) / 86400000;
  if (ageDays <= 6) return { timeframe: "1m", rangeDays: 7 };
  if (ageDays <= 55) return { timeframe: "5m", rangeDays: 60 };
  if (ageDays <= 700) return { timeframe: "1h", rangeDays: 730 };
  return { timeframe: "1d", rangeDays: 36500 };
}

export default async function TradeReplayPage(props: PageProps<"/trades/[id]/replay">) {
  const { id } = await props.params;
  const trade = await getTradeById(id);
  if (!trade) notFound();

  const { timeframe, rangeDays } = pickTimeframe(trade.openedAt);
  const allCandles = (await fetchCandles(trade.symbol, trade.assetType, timeframe, rangeDays)) ?? [];

  const openedSec = trade.openedAt.getTime() / 1000;
  const closedSec = (trade.closedAt ?? trade.openedAt).getTime() / 1000;
  const span = Math.max(closedSec - openedSec, 900);
  const padding = span * 0.5;
  const windowStart = openedSec - padding;
  const windowEnd = closedSec + padding;
  const candles = allCandles.filter((c) => c.time >= windowStart && c.time <= windowEnd);

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex items-center gap-2 text-sm text-text-faint">
        <Link href={`/trades/${trade.id}`} className="hover:text-text">
          {trade.symbol}
        </Link>
        <span>/</span>
        <span>Replay</span>
      </div>
      <h1 className="mb-1 text-2xl font-semibold text-text">Replay: {trade.symbol}</h1>
      <p className="mb-6 text-sm text-text-faint">
        Candle-by-candle replay at {timeframe} resolution — the finest granularity Yahoo
        Finance&apos;s free feed still has data for at this trade&apos;s age. Not tick data.
      </p>

      <TradeReplay
        candles={candles}
        trade={{
          openedAt: trade.openedAt,
          closedAt: trade.closedAt,
          side: trade.side,
          avgEntryPrice: trade.avgEntryPrice,
          avgExitPrice: trade.avgExitPrice,
          symbol: trade.symbol,
          quantity: trade.quantity,
          netPnl: trade.netPnl,
          netRoi: trade.netRoi,
          executions: trade.executions,
        }}
      />
    </div>
  );
}
