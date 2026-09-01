"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createRule(input: {
  name: string;
  description: string;
  frequency: "daily" | "perTrade";
}) {
  const rule = await prisma.progressRule.create({
    data: { name: input.name, description: input.description || null, frequency: input.frequency },
  });
  revalidatePath("/progress");
  revalidatePath("/dashboard");
  return rule;
}

export async function updateRule(
  id: string,
  input: { name: string; description: string },
) {
  await prisma.progressRule.update({
    where: { id },
    data: { name: input.name, description: input.description || null },
  });
  revalidatePath("/progress");
}

export async function toggleRuleActive(id: string, active: boolean) {
  await prisma.progressRule.update({ where: { id }, data: { active } });
  revalidatePath("/progress");
  revalidatePath("/dashboard");
}

export async function deleteRule(id: string) {
  await prisma.progressRule.delete({ where: { id } });
  revalidatePath("/progress");
  revalidatePath("/dashboard");
}

export async function resetRuleHistory(id: string) {
  await prisma.progressState.deleteMany({ where: { ruleId: id } });
  revalidatePath("/progress");
  revalidatePath("/dashboard");
}

export async function setDailyState(ruleId: string, dateKey: string, passed: boolean) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const existing = await prisma.progressState.findFirst({
    where: { ruleId, date, tradeId: null },
  });
  if (existing) {
    await prisma.progressState.update({ where: { id: existing.id }, data: { passed } });
  } else {
    await prisma.progressState.create({ data: { ruleId, date, passed, tradeId: null } });
  }
  revalidatePath("/progress");
  revalidatePath("/dashboard");
}

export async function setTradeState(
  ruleId: string,
  tradeId: string,
  dateKey: string,
  passed: boolean,
) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const existing = await prisma.progressState.findFirst({ where: { ruleId, tradeId } });
  if (existing) {
    await prisma.progressState.update({ where: { id: existing.id }, data: { passed } });
  } else {
    await prisma.progressState.create({ data: { ruleId, date, passed, tradeId } });
  }
  revalidatePath("/progress");
}
