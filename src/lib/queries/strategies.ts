import { prisma } from "@/lib/prisma";

export async function listStrategies() {
  const strategies = await prisma.strategy.findMany({
    where: { archived: false },
    include: {
      _count: { select: { trades: true, missedTrades: true } },
      trades: { select: { netPnl: true, closedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return strategies.map((s) => {
    const closed = s.trades.filter((t) => t.closedAt != null);
    const wins = closed.filter((t) => t.netPnl > 0).length;
    return {
      ...s,
      netPnl: s.trades.reduce((sum, t) => sum + t.netPnl, 0),
      winRate: closed.length > 0 ? wins / closed.length : null,
    };
  });
}

export async function getStrategy(id: string) {
  return prisma.strategy.findUnique({
    where: { id },
    include: {
      trades: { include: { account: true }, orderBy: { openedAt: "desc" } },
      missedTrades: { orderBy: { occurredAt: "desc" } },
    },
  });
}

export async function getStrategyByShareSlug(slug: string) {
  return prisma.strategy.findUnique({
    where: { shareSlug: slug },
    include: {
      trades: { include: { account: true }, orderBy: { openedAt: "desc" } },
    },
  });
}

export type RuleGroup = { group: string; rules: string[] };

export function parseRules(rulesJson: string | null): RuleGroup[] {
  if (!rulesJson) return [];
  try {
    const parsed = JSON.parse(rulesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
