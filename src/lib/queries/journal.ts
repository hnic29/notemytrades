import { prisma } from "@/lib/prisma";

export async function getTradesForDate(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(`${dateKey}T23:59:59.999Z`);
  return prisma.trade.findMany({
    where: {
      isBacktest: false,
      openedAt: { gte: start, lte: end },
    },
    include: { account: true },
    orderBy: { openedAt: "asc" },
  });
}

export async function getDailyNote(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return prisma.dailyNote.findUnique({ where: { date } });
}

/** Dates (yyyy-MM-dd) that have at least one trade, for quick prev/next
 * "jump to nearest trading day" navigation. */
export async function getTradingDayKeys() {
  const trades = await prisma.trade.findMany({
    where: { isBacktest: false },
    select: { openedAt: true },
  });
  const keys = new Set(trades.map((t) => t.openedAt.toISOString().slice(0, 10)));
  return Array.from(keys).sort();
}
