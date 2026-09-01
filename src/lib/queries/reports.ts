import { prisma } from "@/lib/prisma";
import type { ReportFilters } from "@/lib/filters";
import type { ReportTrade } from "@/lib/analytics/grouping";
import type { Prisma } from "@/generated/prisma/client";

export function buildTradeWhere(filters: ReportFilters): Prisma.TradeWhereInput {
  const where: Prisma.TradeWhereInput = { isBacktest: false };

  if (filters.from || filters.to) {
    where.openedAt = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
    };
  }
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.symbol) where.symbol = filters.symbol.toUpperCase();
  if (filters.side) where.side = filters.side;
  if (filters.tag) where.tags = { some: { tag: { name: filters.tag } } };

  return where;
}

export async function fetchReportTrades(filters: ReportFilters): Promise<ReportTrade[]> {
  const trades = await prisma.trade.findMany({
    where: buildTradeWhere(filters),
    include: {
      tags: { include: { tag: true } },
      strategy: true,
    },
    orderBy: { openedAt: "asc" },
  });

  return trades.map((t) => ({
    netPnl: t.netPnl,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    symbol: t.symbol,
    side: t.side as "long" | "short",
    assetType: t.assetType,
    tagNames: t.tags.map((tt) => tt.tag.name),
    strategyName: t.strategy?.name ?? null,
    stopLoss: t.stopLoss,
    profitTarget: t.profitTarget,
    avgEntryPrice: t.avgEntryPrice,
    quantity: t.quantity,
    multiplier: t.multiplier,
  }));
}

export async function listAccountsForFilter() {
  return prisma.account.findMany({
    where: { archived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listTagsForFilter() {
  return prisma.tag.findMany({ select: { name: true }, orderBy: { name: "asc" } });
}
