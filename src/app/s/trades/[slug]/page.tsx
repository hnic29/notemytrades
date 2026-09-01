import { notFound } from "next/navigation";
import { getTradeByShareSlug } from "@/lib/queries/trades";
import { fetchDailyOhlc } from "@/lib/market-data/yahoo";
import { TradeChart } from "@/components/trades/TradeChart";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SharedTradePage(props: PageProps<"/s/trades/[slug]">) {
  const { slug } = await props.params;
  const trade = await getTradeByShareSlug(slug);
  if (!trade) notFound();

  const candles = await fetchDailyOhlc(trade.symbol, trade.assetType);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-text-faint">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-bold text-accent-fg">
            N
          </div>
          Shared from Note My Trades
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-text">
              {trade.symbol}
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium capitalize",
                  trade.side === "long"
                    ? "bg-profit-bg text-profit"
                    : "bg-loss-bg text-loss",
                )}
              >
                {trade.side}
              </span>
            </h1>
            <p className="text-sm text-text-muted">{formatDateTime(trade.openedAt)}</p>
          </div>
          <div
            className={cn(
              "text-right text-2xl font-semibold",
              trade.netPnl >= 0 ? "text-profit" : "text-loss",
            )}
          >
            {formatCurrency(trade.netPnl, trade.account.currency)}
            {trade.netRoi != null && (
              <div className="text-sm font-normal text-text-muted">
                {formatPercent(trade.netRoi)} ROI
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          {candles ? (
            <TradeChart
              candles={candles}
              entryPrice={trade.avgEntryPrice}
              exitPrice={trade.avgExitPrice}
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-center text-sm text-text-faint">
              No chart available for this symbol.
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Quantity" value={String(trade.quantity)} />
          <Stat
            label="Entry"
            value={formatCurrency(trade.avgEntryPrice, trade.account.currency)}
          />
          <Stat
            label="Exit"
            value={
              trade.avgExitPrice != null
                ? formatCurrency(trade.avgExitPrice, trade.account.currency)
                : "Open"
            }
          />
          <Stat
            label="Gross P&L"
            value={formatCurrency(trade.grossPnl, trade.account.currency)}
          />
        </div>

        {trade.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {trade.tags.map((t) => (
              <span
                key={t.tag.id}
                className="rounded-full border border-border-strong px-2.5 py-1 text-xs text-text-muted"
              >
                {t.tag.name}
              </span>
            ))}
          </div>
        )}

        {trade.quickNote && (
          <div className="mt-6 rounded-lg border border-border bg-surface p-4">
            <p className="whitespace-pre-wrap text-sm text-text">{trade.quickNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-text-faint">{label}</div>
      <div className="mt-1 text-sm font-medium text-text">{value}</div>
    </div>
  );
}
