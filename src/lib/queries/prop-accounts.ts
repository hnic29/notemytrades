import { prisma } from "@/lib/prisma";

export async function listPropAccounts() {
  return prisma.propAccount.findMany({
    include: {
      account: true,
      transactions: true,
    },
    orderBy: { startDate: "desc" },
  });
}

export async function listPropAccountsWithTrades() {
  const propAccounts = await listPropAccounts();
  return Promise.all(
    propAccounts.map(async (pa) => ({
      ...pa,
      trades: await prisma.trade.findMany({
        where: { accountId: pa.accountId, isBacktest: false },
        select: { netPnl: true, openedAt: true, closedAt: true },
      }),
    })),
  );
}

export async function getPropAccount(id: string) {
  return prisma.propAccount.findUnique({
    where: { id },
    include: {
      account: {
        include: {
          trades: { orderBy: { openedAt: "desc" } },
        },
      },
      transactions: { orderBy: { occurredAt: "desc" } },
      payouts: { orderBy: { requestedAt: "desc" } },
    },
  });
}
