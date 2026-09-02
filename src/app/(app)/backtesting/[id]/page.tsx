import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/queries/backtesting";
import { getSessionCandles } from "@/lib/backtesting/session-candles";
import { BacktestWorkspace } from "@/components/backtesting/BacktestWorkspace";
import type { ChartDrawing } from "@/components/backtesting/BacktestChart";

export default async function BacktestSessionPage(props: PageProps<"/backtesting/[id]">) {
  const { id } = await props.params;
  const session = await getSession(id);
  if (!session) notFound();

  const candles = await getSessionCandles(session);
  const drawings: ChartDrawing[] = session.drawings.map((d) =>
    d.type === "horizontal"
      ? { id: d.id, type: "horizontal", price1: d.price1, time1: null, time2: null, price2: null }
      : { id: d.id, type: "trendline", time1: d.time1!, price1: d.price1, time2: d.time2!, price2: d.price2! },
  );

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
        assetType={session.assetType}
        timeframe={session.timeframe}
        status={session.status}
        shareSlug={session.shareSlug}
        candles={candles}
        trades={session.trades}
        pendingOrders={session.orders}
        drawings={drawings}
        startingBalance={session.account?.startingBalance ?? 0}
        startDate={session.startDate}
        endDate={session.endDate}
      />
    </div>
  );
}
