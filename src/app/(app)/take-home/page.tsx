import { listBrokerProfiles, listClosedTradesForTakeHome } from "@/lib/queries/broker-fees";
import { getSettings } from "@/lib/queries/settings";
import { seedDefaultBrokerProfiles } from "@/lib/actions/broker-fees";
import { TakeHomeView } from "@/components/take-home/TakeHomeView";

export default async function TakeHomePage() {
  await seedDefaultBrokerProfiles();

  const [profiles, trades, settings] = await Promise.all([
    listBrokerProfiles(),
    listClosedTradesForTakeHome(),
    getSettings(),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-text">Take-Home</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-muted">
        What you made minus what each trade actually cost. Pick the broker your account is
        really with, and every day/week/month/year figure below applies its real per-transaction
        fees to your trade history — so a winning streak reads as what you&apos;d actually keep,
        not the raw price movement.
      </p>

      <TakeHomeView
        profiles={profiles.map((p) => ({
          id: p.id,
          name: p.name,
          isCustom: p.isCustom,
          perContractFeeFutures: p.perContractFeeFutures,
          perContractFeeOptions: p.perContractFeeOptions,
          perShareFeeStock: p.perShareFeeStock,
          minFeePerOrder: p.minFeePerOrder,
          monthlyPlatformFee: p.monthlyPlatformFee,
          sourceUrl: p.sourceUrl,
          feesAsOf: p.feesAsOf ? p.feesAsOf.toISOString() : null,
          notes: p.notes,
        }))}
        trades={trades.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          assetType: t.assetType,
          quantity: t.quantity,
          avgExitPrice: t.avgExitPrice,
          closedAt: t.closedAt ? t.closedAt.toISOString() : null,
          grossPnl: t.grossPnl,
          fees: t.fees,
          commissions: t.commissions,
        }))}
        selectedBrokerProfileId={settings.selectedBrokerProfileId}
        taxSetAsidePct={settings.taxSetAsidePct}
      />
    </div>
  );
}
