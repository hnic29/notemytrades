import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Full-data JSON backup, downloaded straight from the browser — a
 * Route Handler rather than a Server Action so we can set a real
 * Content-Disposition header and let the browser's native "Save As"
 * handle files that could grow past a server action's response size
 * expectations after years of trading history.
 *
 * Deliberately excludes AppSettings (holds the AI API key — a secret,
 * not trading data) and the unused Widget model.
 */
export async function GET() {
  const [
    accounts,
    trades,
    executions,
    tags,
    tradeTags,
    strategies,
    missedTrades,
    folders,
    notes,
    noteTags,
    noteTemplates,
    dailyNotes,
    progressRules,
    progressStates,
    propAccounts,
    propTransactions,
    propPayouts,
    backtestSessions,
  ] = await Promise.all([
    prisma.account.findMany(),
    prisma.trade.findMany(),
    prisma.execution.findMany(),
    prisma.tag.findMany(),
    prisma.tradeTag.findMany(),
    prisma.strategy.findMany(),
    prisma.missedTrade.findMany(),
    prisma.folder.findMany(),
    prisma.note.findMany(),
    prisma.noteTag.findMany(),
    prisma.noteTemplate.findMany(),
    prisma.dailyNote.findMany(),
    prisma.progressRule.findMany(),
    prisma.progressState.findMany(),
    prisma.propAccount.findMany(),
    prisma.propTransaction.findMany(),
    prisma.propPayout.findMany(),
    prisma.backtestSession.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    accounts,
    trades,
    executions,
    tags,
    tradeTags,
    strategies,
    missedTrades,
    folders,
    notes,
    noteTags,
    noteTemplates,
    dailyNotes,
    progressRules,
    progressStates,
    propAccounts,
    propTransactions,
    propPayouts,
    backtestSessions,
  };

  const filename = `notemytrades-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
