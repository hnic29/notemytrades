import { notFound } from "next/navigation";
import { getSessionByShareSlug } from "@/lib/queries/backtesting";
import { fetchCandles, type Timeframe } from "@/lib/market-data/yahoo";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { BacktestChart } from "@/components/backtesting/BacktestChart";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SharedBacktestPage(props: PageProps<"/s/backtesting/[slug]">) {
  const { slug } = await props.params;
  const session = await getSessionByShareSlug(slug);
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

  const stats = computeSummaryStats(session.trades);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-text-faint">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-bold text-accent-fg">
            N
          </div>
          Shared from Note My Trades
        </div>

        <h1 className="mb-1 text-2xl font-semibold">{session.name}</h1>
        <p className="mb-6 text-sm text-text-faint">
          {session.symbol} · {session.timeframe} · {formatDate(session.startDate)} –{" "}
          {formatDate(session.endDate)}
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Net P&L"
            value={formatCurrency(stats.netPnl)}
            tone={stats.netPnl >= 0 ? "profit" : "loss"}
          />
          <Stat label="Trades" value={String(stats.closedTrades)} />
          <Stat label="Win Rate" value={stats.winRate != null ? formatPercent(stats.winRate) : "—"} />
          <Stat
            label="Profit Factor"
            value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
          />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          {candles.length === 0 ? (
            <p className="py-16 text-center text-sm text-text-faint">No chart data available.</p>
          ) : (
            <BacktestChart candles={candles} trades={session.trades} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          !tone && "text-text",
        )}
      >
        {value}
      </div>
    </div>
  );
}
