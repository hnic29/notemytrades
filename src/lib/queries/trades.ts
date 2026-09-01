import { prisma } from "@/lib/prisma";

export async function listTradesWithAccount(filters?: {
  accountId?: string;
  symbol?: string;
}) {
  return prisma.trade.findMany({
    where: {
      isBacktest: false,
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.symbol ? { symbol: filters.symbol.toUpperCase() } : {}),
    },
    include: {
      account: true,
      tags: { include: { tag: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}

export async function getTradeById(id: string) {
  return prisma.trade.findUnique({
    where: { id },
    include: {
      account: true,
      executions: { orderBy: { timestamp: "asc" } },
      tags: { include: { tag: true } },
      strategy: true,
    },
  });
}

export async function getTradeByShareSlug(slug: string) {
  return prisma.trade.findUnique({
    where: { shareSlug: slug },
    include: {
      account: true,
      tags: { include: { tag: true } },
    },
  });
}

export type TradeWithAccount = Awaited<
  ReturnType<typeof listTradesWithAccount>
>[number];
