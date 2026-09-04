import { prisma } from "@/lib/prisma";

export async function getDashboardTrades() {
  return prisma.trade.findMany({
    where: { isBacktest: false },
    select: {
      id: true,
      netPnl: true,
      openedAt: true,
      closedAt: true,
      symbol: true,
      avgEntryPrice: true,
      stopLoss: true,
      quantity: true,
      multiplier: true,
    },
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

/** Every date (as a YYYY-MM-DD key) with a non-empty Daily Journal
 * entry — feeds the dashboard calendar's note indicator dot. A row
 * can exist with empty/whitespace-only content (opened, never
 * written in), which shouldn't count as "has an entry." Despite the
 * column name, DailyNote.contentJson is plain textarea text, not a
 * serialized rich-text doc — see DailyNoteEditor.
 *
 * Deliberately NOT localDateKey here: saveDailyNote/getDailyNote both
 * encode a date-key as UTC midnight (`new Date(\`${dateKey}T00:00:00.000Z\`)`),
 * not local midnight the way trade timestamps work — reading it back
 * through localDateKey would shift the day whenever the server isn't
 * on UTC. Pulling the date straight out of the ISO string reverses
 * that same encoding regardless of local timezone. */
export async function getJournaledDateKeys(): Promise<Set<string>> {
  const notes = await prisma.dailyNote.findMany({
    where: { contentJson: { not: null } },
    select: { date: true, contentJson: true },
  });
  const keys = new Set<string>();
  for (const n of notes) {
    if (!n.contentJson || n.contentJson.trim() === "") continue;
    keys.add(n.date.toISOString().slice(0, 10));
  }
  return keys;
}
