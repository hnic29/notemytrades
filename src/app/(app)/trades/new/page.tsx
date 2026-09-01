import { listAccounts, getOrCreateDefaultAccount } from "@/lib/actions/accounts";
import { TradeForm } from "@/components/trades/TradeForm";

export default async function NewTradePage() {
  await getOrCreateDefaultAccount();
  const accounts = await listAccounts();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text">Add Trade</h1>
      <TradeForm accounts={accounts} />
    </div>
  );
}
