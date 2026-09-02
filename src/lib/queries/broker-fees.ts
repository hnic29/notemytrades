import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries/settings";

export async function listBrokerProfiles() {
  return prisma.brokerFeeProfile.findMany({ orderBy: [{ isCustom: "asc" }, { name: "asc" }] });
}

export async function getBrokerProfile(id: string) {
  return prisma.brokerFeeProfile.findUnique({ where: { id } });
}

/** Every closed trade across every real (non-backtest) account — the
 * Take-Home page's input. Backtest trades are simulated fills against
 * historical data with no real cost to estimate, so they're excluded
 * the same way listTradesWithAccount already excludes them. */
export async function listClosedTradesForTakeHome() {
  return prisma.trade.findMany({
    where: { isBacktest: false, status: "closed" },
    select: {
      id: true,
      symbol: true,
      assetType: true,
      quantity: true,
      avgExitPrice: true,
      closedAt: true,
      grossPnl: true,
      fees: true,
      commissions: true,
    },
    orderBy: { closedAt: "desc" },
  });
}

export async function getSelectedBrokerProfile() {
  const settings = await getSettings();
  if (!settings.selectedBrokerProfileId) return null;
  return prisma.brokerFeeProfile.findUnique({ where: { id: settings.selectedBrokerProfileId } });
}
