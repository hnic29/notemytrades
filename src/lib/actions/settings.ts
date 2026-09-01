"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries/settings";
import { chatComplete, listModels } from "@/lib/ai/client";

const SINGLETON_ID = "singleton";

export async function updateAiSettings(input: {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
}) {
  await getSettings(); // ensure the row exists
  await prisma.appSettings.update({
    where: { id: SINGLETON_ID },
    data: {
      aiBaseUrl: input.aiBaseUrl.trim() || null,
      aiApiKey: input.aiApiKey.trim() || null,
      aiModel: input.aiModel.trim() || null,
    },
  });
  revalidatePath("/settings");
}

export async function testAiConnection(): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const text = await chatComplete([
      { role: "user", content: "Reply with a single short sentence confirming you can hear this." },
    ]);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export async function listAiModels(): Promise<
  { ok: true; models: string[] } | { ok: false; error: string }
> {
  try {
    const models = await listModels();
    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

/**
 * Deletes every trade/journal/strategy/prop/backtest row, in an order
 * that respects the non-cascading foreign keys (Trade -> Strategy/
 * Note/BacktestSession, Note -> Folder, BacktestSession/PropAccount ->
 * Account) — SQLite's FK enforcement is connection-dependent, so this
 * doesn't rely on cascades alone. Deliberately leaves AppSettings
 * untouched (AI config, onboarded state) — this clears trading data,
 * not app configuration.
 */
export async function resetAllTradingData(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await prisma.$transaction([
      prisma.tradeTag.deleteMany(),
      prisma.noteTag.deleteMany(),
      prisma.execution.deleteMany(),
      prisma.missedTrade.deleteMany(),
      prisma.propTransaction.deleteMany(),
      prisma.propPayout.deleteMany(),
      prisma.progressState.deleteMany(),
      prisma.trade.deleteMany(),
      prisma.note.deleteMany(),
      prisma.backtestSession.deleteMany(),
      prisma.propAccount.deleteMany(),
      prisma.strategy.deleteMany(),
      prisma.folder.deleteMany(),
      prisma.progressRule.deleteMany(),
      prisma.widget.deleteMany(),
      prisma.noteTemplate.deleteMany(),
      prisma.dailyNote.deleteMany(),
      prisma.tag.deleteMany(),
      prisma.account.deleteMany(),
    ]);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to reset data" };
  }
}

export async function markOnboarded() {
  await getSettings();
  await prisma.appSettings.update({
    where: { id: SINGLETON_ID },
    data: { onboardedAt: new Date() },
  });
  revalidatePath("/", "layout");
}
