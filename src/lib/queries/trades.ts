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

/**
 * Feeds the Trade Replay picker (/trades/replay) — a trade needs both an
 * entry and an exit to have anything worth replaying, so open trades and
 * backtest fills are excluded here rather than filtered in the UI.
 */
export async function listReplayableTrades(limit = 200) {
  return prisma.trade.findMany({
    where: { isBacktest: false, closedAt: { not: null } },
    orderBy: { openedAt: "desc" },
    take: limit,
    select: {
      id: true,
      symbol: true,
      assetType: true,
      side: true,
      quantity: true,
      avgEntryPrice: true,
      avgExitPrice: true,
      openedAt: true,
      closedAt: true,
      netPnl: true,
      netRoi: true,
    },
  });
}

export type ReplayableTrade = Awaited<ReturnType<typeof listReplayableTrades>>[number];

export async function getTradeById(id: string) {
  return prisma.trade.findUnique({
    where: { id },
    include: {
      account: true,
      executions: { orderBy: { timestamp: "asc" } },
      tags: { include: { tag: true } },
      strategy: true,
      note: true,
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
