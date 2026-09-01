import { notFound } from "next/navigation";
import Link from "next/link";
import { getPropAccount } from "@/lib/queries/prop-accounts";
import { computePropAccountMetrics } from "@/lib/analytics/prop-account";
import { StatCard } from "@/components/dashboard/StatCard";
import { PropAccountActions } from "@/components/prop-accounts/PropAccountActions";
import { TransactionLog } from "@/components/prop-accounts/TransactionLog";
import { PayoutLog } from "@/components/prop-accounts/PayoutLog";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function PropAccountDetailPage(props: PageProps<"/prop-accounts/[id]">) {
  const { id } = await props.params;
  const propAccount = await getPropAccount(id);
  if (!propAccount) notFound();

  const todayKey = new Date().toISOString().slice(0, 10);
  const metrics = computePropAccountMetrics({
    accountSize: propAccount.accountSize,
    trades: propAccount.account.trades,
    transactionTotal: propAccount.transactions.reduce((s, t) => s + t.amount, 0),
    profitTarget: propAccount.profitTarget,
    maxDailyLoss: propAccount.maxDailyLoss,
    maxTotalDrawdown: propAccount.maxTotalDrawdown,
    todayKey,
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex items-center gap-2 text-sm text-text-faint">
        <Link href="/prop-accounts" className="hover:text-text">
          Prop Accounts
        </Link>
        <span>/</span>
        <span>{propAccount.account.name}</span>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-text">{propAccount.account.name}</h1>
        <p className="text-sm text-text-muted">
          {propAccount.firmName} · {propAccount.challengeType}
          {propAccount.startDate && ` · started ${formatDate(propAccount.startDate)}`}
        </p>
      </div>

      <div className="mb-6">
        <PropAccountActions propAccountId={propAccount.id} phase={propAccount.phase} />
      </div>

      {(metrics.dailyLossBreached || metrics.totalDrawdownBreached) && (
        <div className="mb-4 rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">
          {metrics.dailyLossBreached && "Daily loss limit breached. "}
          {metrics.totalDrawdownBreached && "Total drawdown limit breached."}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Current Balance" value={formatCurrency(metrics.currentBalance)} />
        <StatCard
          label="Net P&L"
          value={formatCurrency(metrics.netPnl)}
          tone={metrics.netPnl >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="Profit Target Progress"
          value={
            metrics.profitProgressPct != null ? formatPercent(metrics.profitProgressPct) : "—"
          }
          sub={propAccount.profitTarget ? formatCurrency(propAccount.profitTarget) : undefined}
        />
        <StatCard
          label="Today's P&L"
          value={formatCurrency(metrics.todayPnl)}
          tone={metrics.todayPnl >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="Max Daily Loss"
          value={propAccount.maxDailyLoss ? formatCurrency(propAccount.maxDailyLoss) : "—"}
        />
        <StatCard
          label="Max Total Drawdown"
          value={propAccount.maxTotalDrawdown ? formatCurrency(propAccount.maxTotalDrawdown) : "—"}
        />
        <StatCard
          label="Current Drawdown"
          value={formatCurrency(metrics.totalDrawdown)}
          tone={metrics.totalDrawdownBreached ? "loss" : "neutral"}
        />
        <StatCard label="Account Size" value={formatCurrency(propAccount.accountSize)} />
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">
          Trades ({propAccount.account.trades.length})
        </h2>
        {propAccount.account.trades.length === 0 ? (
          <p className="text-sm text-text-faint">
            No trades yet.{" "}
            <Link href="/trades/new" className="text-accent hover:underline">
              Log one
            </Link>{" "}
            against this account.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-text-faint">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {propAccount.account.trades.slice(0, 10).map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-3 py-2 text-text-muted">{formatDate(t.openedAt)}</td>
                    <td className="px-3 py-2 font-medium text-text">
                      <Link href={`/trades/${t.id}`} className="hover:text-accent">
                        {t.symbol}
                      </Link>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 font-medium",
                        t.netPnl >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      {formatCurrency(t.netPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Transactions</h2>
        <TransactionLog propAccountId={propAccount.id} transactions={propAccount.transactions} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Payouts</h2>
        <PayoutLog propAccountId={propAccount.id} payouts={propAccount.payouts} />
      </div>
    </div>
  );
}
