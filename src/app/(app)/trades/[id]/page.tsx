import { notFound } from "next/navigation";
import Link from "next/link";
import { getTradeById } from "@/lib/queries/trades";
import { fetchDailyOhlc } from "@/lib/market-data/yahoo";
import { TradeChart } from "@/components/trades/TradeChart";
import { TradeDetailActions } from "@/components/trades/TradeDetailActions";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function TradeDetailPage(props: PageProps<"/trades/[id]">) {
  const { id } = await props.params;
  const trade = await getTradeById(id);
  if (!trade) notFound();

  const candles = await fetchDailyOhlc(trade.symbol, trade.assetType);

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex items-center gap-2 text-sm text-text-faint">
        <Link href="/trades" className="hover:text-text">
          Trade Log
        </Link>
        <span>/</span>
        <span>{trade.symbol}</span>
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
          <p className="text-sm text-text-muted">
            {trade.account.name} · {formatDateTime(trade.openedAt)}
          </p>
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

      <TradeDetailActions tradeId={trade.id} shareSlug={trade.shareSlug} />

      <div className="my-6 rounded-lg border border-border bg-surface p-4">
        {candles ? (
          <TradeChart
            candles={candles}
            entryPrice={trade.avgEntryPrice}
            exitPrice={trade.avgExitPrice}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-center text-sm text-text-faint">
            No chart available for this symbol — daily-bar market data only
            covers US stocks and major FX pairs without an API key.
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
          label="Fees + Commissions"
          value={formatCurrency(trade.fees + trade.commissions, trade.account.currency)}
        />
        <Stat
          label="Stop Loss"
          value={
            trade.stopLoss != null
              ? formatCurrency(trade.stopLoss, trade.account.currency)
              : "—"
          }
        />
        <Stat
          label="Profit Target"
          value={
            trade.profitTarget != null
              ? formatCurrency(trade.profitTarget, trade.account.currency)
              : "—"
          }
        />
        <Stat label="Gross P&L" value={formatCurrency(trade.grossPnl, trade.account.currency)} />
        <Stat label="Source" value={trade.source ?? "manual"} />
        {trade.strategy && (
          <Stat
            label="Strategy"
            value={trade.strategy.name}
            href={`/strategies/${trade.strategy.id}`}
          />
        )}
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
          <h2 className="mb-2 text-sm font-medium text-text-muted">Note</h2>
          <p className="whitespace-pre-wrap text-sm text-text">{trade.quickNote}</p>
        </div>
      )}

      {trade.note && (
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-medium text-text-muted">Linked Notebook Entry</h2>
          <Link href={`/notebook?note=${trade.note.id}`} className="text-sm text-accent hover:underline">
            {trade.note.title || "Untitled note"}
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-text-faint">{label}</div>
      {href ? (
        <Link href={href} className="mt-1 block text-sm font-medium text-accent hover:underline">
          {value}
        </Link>
      ) : (
        <div className="mt-1 text-sm font-medium text-text">{value}</div>
      )}
    </div>
  );
}
