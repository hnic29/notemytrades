import { notFound } from "next/navigation";
import { getSessionByShareSlug } from "@/lib/queries/backtesting";
import { getSessionCandles } from "@/lib/backtesting/session-candles";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { BacktestChart, type ChartDrawing } from "@/components/backtesting/BacktestChart";
import { Logo } from "@/components/layout/Logo";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SharedBacktestPage(props: PageProps<"/s/backtesting/[slug]">) {
  const { slug } = await props.params;
  const session = await getSessionByShareSlug(slug);
  if (!session) notFound();

  const candles = await getSessionCandles(session);
  const drawings: ChartDrawing[] = session.drawings.map((d) =>
    d.type === "horizontal"
      ? { id: d.id, type: "horizontal", price1: d.price1, time1: null, time2: null, price2: null }
      : { id: d.id, type: "trendline", time1: d.time1!, price1: d.price1, time2: d.time2!, price2: d.price2! },
  );

  const stats = computeSummaryStats(session.trades);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-text-faint">
          <Logo className="h-[38px] w-[38px] shrink-0 object-contain" />
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
            <BacktestChart candles={candles} trades={session.trades} drawings={drawings} />
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
