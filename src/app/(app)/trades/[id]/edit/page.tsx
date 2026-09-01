import { notFound } from "next/navigation";
import { listAccounts } from "@/lib/actions/accounts";
import { getTradeById } from "@/lib/queries/trades";
import { listStrategies } from "@/lib/queries/strategies";
import { TradeForm, type TradeFormInitial } from "@/components/trades/TradeForm";
import { toDatetimeLocalValue } from "@/lib/format";

export default async function EditTradePage(props: PageProps<"/trades/[id]/edit">) {
  const { id } = await props.params;
  const [trade, accounts, strategies] = await Promise.all([
    getTradeById(id),
    listAccounts(),
    listStrategies(),
  ]);
  if (!trade) notFound();

  const initial: TradeFormInitial = {
    id: trade.id,
    accountId: trade.accountId,
    symbol: trade.symbol,
    assetType: trade.assetType,
    side: trade.side as "long" | "short",
    quantity: trade.quantity,
    multiplier: trade.multiplier,
    avgEntryPrice: trade.avgEntryPrice,
    avgExitPrice: trade.avgExitPrice,
    openedAt: toDatetimeLocalValue(trade.openedAt),
    closedAt: toDatetimeLocalValue(trade.closedAt),
    fees: trade.fees,
    commissions: trade.commissions,
    stopLoss: trade.stopLoss,
    profitTarget: trade.profitTarget,
    quickNote: trade.quickNote,
    tagNames: trade.tags.map((t) => t.tag.name),
    strategyId: trade.strategyId,
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text">Edit Trade</h1>
      <TradeForm accounts={accounts} strategies={strategies} initial={initial} />
    </div>
  );
}
