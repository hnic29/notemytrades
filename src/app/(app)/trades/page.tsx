import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { listTradesWithAccount } from "@/lib/queries/trades";
import { listAccounts } from "@/lib/actions/accounts";
import { TradeLogTable } from "@/components/trades/TradeLogTable";

export default async function TradesPage() {
  const [trades, accounts] = await Promise.all([listTradesWithAccount(), listAccounts()]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Trade Log</h1>
          <p className="text-sm text-text-muted">
            {trades.length} trade{trades.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/trades/import"
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm text-text hover:bg-surface-2"
          >
            <Upload className="h-4 w-4" /> Import
          </Link>
          <Link
            href="/trades/new"
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong"
          >
            <Plus className="h-4 w-4" /> Add Trade
          </Link>
        </div>
      </div>

      <TradeLogTable trades={trades} accounts={accounts} />
    </div>
  );
}
