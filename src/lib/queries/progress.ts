import { prisma } from "@/lib/prisma";

export async function listRules() {
  return prisma.progressRule.findMany({ orderBy: { createdAt: "asc" } });
}

export async function listActiveDailyRules() {
  return prisma.progressRule.findMany({
    where: { active: true, frequency: "daily" },
    orderBy: { createdAt: "asc" },
  });
}

export async function listActivePerTradeRules() {
  return prisma.progressRule.findMany({
    where: { active: true, frequency: "perTrade" },
    orderBy: { createdAt: "asc" },
  });
}

export async function getStatesForDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return prisma.progressState.findMany({ where: { date } });
}

/** Last N distinct dates (yyyy-MM-dd) that have any daily-rule state
 * recorded, most recent first — used to compute the adherence streak. */
export async function listRecentDailyResults(limit = 60) {
  const rules = await listActiveDailyRules();
  if (rules.length === 0) return [];

  const states = await prisma.progressState.findMany({
    where: { ruleId: { in: rules.map((r) => r.id) } },
    orderBy: { date: "desc" },
  });

  const byDate = new Map<string, { passed: number; evaluated: number }>();
  for (const s of states) {
    const key = s.date.toISOString().slice(0, 10);
    const entry = byDate.get(key) ?? { passed: 0, evaluated: 0 };
    entry.evaluated++;
    if (s.passed) entry.passed++;
    byDate.set(key, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, { passed, evaluated }]) => ({
      date,
      passed,
      evaluated,
      totalActiveRules: rules.length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export async function getRecentTradesForChecklist(limit = 15) {
  return prisma.trade.findMany({
    where: { isBacktest: false },
    orderBy: { openedAt: "desc" },
    take: limit,
    select: { id: true, symbol: true, openedAt: true },
  });
}

export async function getTradeRuleStates(tradeIds: string[]) {
  if (tradeIds.length === 0) return [];
  return prisma.progressState.findMany({
    where: { tradeId: { in: tradeIds } },
  });
}
