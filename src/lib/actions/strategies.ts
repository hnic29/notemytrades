"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { RuleGroup } from "@/lib/queries/strategies";

export async function createStrategy(input: {
  name: string;
  description: string;
  rules: RuleGroup[];
}) {
  const strategy = await prisma.strategy.create({
    data: {
      name: input.name,
      description: input.description || null,
      rulesJson: JSON.stringify(input.rules),
    },
  });
  revalidatePath("/strategies");
  return strategy;
}

export async function updateStrategy(
  id: string,
  input: { name: string; description: string; rules: RuleGroup[] },
) {
  const strategy = await prisma.strategy.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description || null,
      rulesJson: JSON.stringify(input.rules),
    },
  });
  revalidatePath("/strategies");
  revalidatePath(`/strategies/${id}`);
  return strategy;
}

export async function deleteStrategy(id: string) {
  await prisma.strategy.delete({ where: { id } });
  revalidatePath("/strategies");
}

export async function assignTradeToStrategy(tradeId: string, strategyId: string | null) {
  const previous = await prisma.trade.findUniqueOrThrow({
    where: { id: tradeId },
    select: { strategyId: true },
  });
  await prisma.trade.update({ where: { id: tradeId }, data: { strategyId } });
  revalidatePath("/strategies");
  revalidatePath(`/trades/${tradeId}`);
  if (strategyId) revalidatePath(`/strategies/${strategyId}`);
  if (previous.strategyId) revalidatePath(`/strategies/${previous.strategyId}`);
}

export async function logMissedTrade(
  strategyId: string,
  input: { symbol: string; notes: string; occurredAt: string },
) {
  await prisma.missedTrade.create({
    data: {
      strategyId,
      symbol: input.symbol.toUpperCase(),
      notes: input.notes || null,
      occurredAt: new Date(input.occurredAt),
    },
  });
  revalidatePath(`/strategies/${strategyId}`);
}

export async function deleteMissedTrade(id: string, strategyId: string) {
  await prisma.missedTrade.delete({ where: { id } });
  revalidatePath(`/strategies/${strategyId}`);
}

export async function generateStrategyShareLink(id: string) {
  const strategy = await prisma.strategy.findUniqueOrThrow({ where: { id } });
  if (strategy.shareSlug) return strategy.shareSlug;
  const slug = randomBytes(6).toString("hex");
  await prisma.strategy.update({ where: { id }, data: { shareSlug: slug } });
  revalidatePath(`/strategies/${id}`);
  return slug;
}

export async function revokeStrategyShareLink(id: string) {
  await prisma.strategy.update({ where: { id }, data: { shareSlug: null } });
  revalidatePath(`/strategies/${id}`);
}

export async function searchTradesToAttach(query: string) {
  if (!query.trim()) return [];
  return prisma.trade.findMany({
    where: { symbol: { contains: query.toUpperCase() } },
    select: { id: true, symbol: true, openedAt: true, netPnl: true, strategyId: true },
    orderBy: { openedAt: "desc" },
    take: 10,
  });
}
