import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/queries/backtesting";
import { getSessionCandles } from "@/lib/backtesting/session-candles";
import { BacktestWorkspace } from "@/components/backtesting/BacktestWorkspace";

export default async function BacktestSessionPage(props: PageProps<"/backtesting/[id]">) {
  const { id } = await props.params;
  const session = await getSession(id);
  if (!session) notFound();

  const candles = await getSessionCandles(session);

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
        status={session.status}
        shareSlug={session.shareSlug}
        candles={candles}
        trades={session.trades}
        pendingOrders={session.orders}
        startingBalance={session.account?.startingBalance ?? 0}
        startDate={session.startDate}
        endDate={session.endDate}
      />
    </div>
  );
}
