import { prisma } from "@/lib/prisma";
import { localDateKey, localDayRange } from "@/lib/date-key";

/**
 * Every trade that "touches" this local day — opened today (even if
 * still open) or closed today. The calendar/dashboard's day P&L only
 * ever counts trades by their close day (computeDailyPnl), so a trade
 * opened today but closed tomorrow (or vice versa) still needs to show
 * up here for the numbers to agree with what the calendar cell says —
 * see JournalPage's dayNetPnl, which re-filters this list down to
 * exactly the closed-today trades before summing.
 */
export async function getTradesForDate(dateKey: string) {
  const { start, end } = localDayRange(dateKey);
  return prisma.trade.findMany({
    where: {
      isBacktest: false,
      OR: [{ openedAt: { gte: start, lte: end } }, { closedAt: { gte: start, lte: end } }],
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
  const keys = new Set(trades.map((t) => localDateKey(t.openedAt)));
  return Array.from(keys).sort();
}
