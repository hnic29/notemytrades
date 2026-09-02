import { prisma } from "@/lib/prisma";

/**
 * Upserts each tag by name and attaches it to a trade. Shared by
 * live-trade entry/edit (trades.ts) and any other trade-mutating
 * action — including backtest trades, which are ordinary Trade rows —
 * so tagging behaves identically everywhere a trade can be tagged.
 */
export async function attachTags(tradeId: string, tagNames: string[]): Promise<void> {
  for (const raw of tagNames) {
    const name = raw.trim();
    if (!name) continue;
    const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.tradeTag.upsert({
      where: { tradeId_tagId: { tradeId, tagId: tag.id } },
      update: {},
      create: { tradeId, tagId: tag.id },
    });
  }
}
