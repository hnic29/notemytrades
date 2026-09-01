import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/queries/backtesting";
import { fetchCandles, type Timeframe } from "@/lib/market-data/yahoo";
import { BacktestWorkspace } from "@/components/backtesting/BacktestWorkspace";

export default async function BacktestSessionPage(props: PageProps<"/backtesting/[id]">) {
  const { id } = await props.params;
  const session = await getSession(id);
  if (!session) notFound();

  const rangeDays = Math.max(
    1,
    Math.ceil((session.endDate.getTime() - session.startDate.getTime()) / 86400000) + 1,
  );
  const allCandles =
    (await fetchCandles(session.symbol, "stock", session.timeframe as Timeframe, rangeDays)) ?? [];

  const startSec = session.startDate.getTime() / 1000;
  const endSec = session.endDate.getTime() / 1000 + 86400;
  const candles = allCandles.filter((c) => c.time >= startSec && c.time <= endSec);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-text-faint">
        <Link href="/backtesting" className="hover:text-text">
          Backtesting &amp; Replay
        </Link>
        <span>/</span>
        <span>{session.name}</span>
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-text">{session.name}</h1>

      <BacktestWorkspace
        sessionId={session.id}
        accountId={session.accountId!}
        symbol={session.symbol}
        status={session.status}
        shareSlug={session.shareSlug}
        candles={candles}
        trades={session.trades}
      />
    </div>
  );
}
