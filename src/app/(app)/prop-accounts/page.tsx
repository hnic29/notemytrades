import Link from "next/link";
import { Plus } from "lucide-react";
import { listPropAccountsWithTrades } from "@/lib/queries/prop-accounts";
import { computePropAccountMetrics } from "@/lib/analytics/prop-account";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function PropAccountsPage() {
  const propAccounts = await listPropAccountsWithTrades();
  const todayKey = new Date().toISOString().slice(0, 10);

  const rows = propAccounts.map((pa) => {
    const metrics = computePropAccountMetrics({
      accountSize: pa.accountSize,
      trades: pa.trades,
      transactionTotal: pa.transactions.reduce((s, t) => s + t.amount, 0),
      profitTarget: pa.profitTarget,
      maxDailyLoss: pa.maxDailyLoss,
      maxTotalDrawdown: pa.maxTotalDrawdown,
      todayKey,
    });
    return { pa, metrics };
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Prop Accounts</h1>
        <Link
          href="/prop-accounts/new"
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          <Plus className="h-4 w-4" /> Add Prop Account
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-text-muted">
          No prop accounts yet. Track a challenge or funded account here — profit target,
          drawdown limits, and payouts, all in one place.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ pa, metrics }) => (
            <Link
              key={pa.id}
              href={`/prop-accounts/${pa.id}`}
              className="rounded-lg border border-border bg-surface p-4 hover:border-border-strong"
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-medium text-text">{pa.account.name}</h2>
                <span className="rounded-full border border-border-strong px-2 py-0.5 text-[10px] capitalize text-text-faint">
                  {pa.phase}
                </span>
              </div>
              <p className="mb-3 text-xs text-text-faint">
                {pa.firmName} · {pa.challengeType}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Balance</span>
                <span className="font-medium text-text">
                  {formatCurrency(metrics.currentBalance)}
                </span>
              </div>
              {metrics.profitProgressPct != null && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-text-faint">Profit target</span>
                    <span className="text-text-muted">
                      {formatPercent(Math.max(0, metrics.profitProgressPct))}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.min(100, Math.max(0, metrics.profitProgressPct * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {(metrics.dailyLossBreached || metrics.totalDrawdownBreached) && (
                <p className={cn("mt-2 text-xs font-medium text-loss")}>
                  {metrics.dailyLossBreached && "Daily loss limit breached. "}
                  {metrics.totalDrawdownBreached && "Total drawdown limit breached."}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
