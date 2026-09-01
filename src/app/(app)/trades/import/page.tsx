import { getOrCreateDefaultAccount, listAccounts } from "@/lib/actions/accounts";
import { ImportWizard } from "@/components/trades/ImportWizard";

export default async function ImportTradesPage() {
  await getOrCreateDefaultAccount();
  const accounts = await listAccounts();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-text">Import Trades</h1>
      <p className="mb-6 text-sm text-text-muted">
        Upload a CSV export from your broker or platform. We&apos;ll try to
        detect the format automatically — otherwise map the columns
        yourself.
      </p>
      <ImportWizard accounts={accounts} />
    </div>
  );
}
