import { prisma } from "@/lib/prisma";

export async function getDashboardTrades() {
  return prisma.trade.findMany({
    where: { isBacktest: false },
    select: { id: true, netPnl: true, openedAt: true, closedAt: true, symbol: true },
    orderBy: { openedAt: "asc" },
  });
}

export async function getTotalStartingBalance() {
  const accounts = await prisma.account.findMany({
    where: { archived: false },
    select: { startingBalance: true },
  });
  return accounts.reduce((sum, a) => sum + a.startingBalance, 0);
}
