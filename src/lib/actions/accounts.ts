"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function listAccounts() {
  return prisma.account.findMany({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrCreateDefaultAccount() {
  const existing = await prisma.account.findFirst({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.account.create({
    data: { name: "Main Account", assetType: "mixed", currency: "USD" },
  });
}

/** Backtested trades still need a real Account row (accountId is
 * required on Trade), but they should never show up mixed in with a
 * real trading account's balance — so backtesting gets one dedicated,
 * auto-created account, shared across every session. */
export async function getOrCreateBacktestAccount() {
  const existing = await prisma.account.findFirst({ where: { name: "Backtesting" } });
  if (existing) return existing;

  return prisma.account.create({
    data: { name: "Backtesting", assetType: "mixed", currency: "USD" },
  });
}

export async function createAccount(input: {
  name: string;
  broker?: string;
  assetType?: string;
  currency?: string;
  startingBalance?: number;
}) {
  const account = await prisma.account.create({
    data: {
      name: input.name,
      broker: input.broker || null,
      assetType: input.assetType || "mixed",
      currency: input.currency || "USD",
      startingBalance: input.startingBalance ?? 0,
    },
  });
  revalidatePath("/trades");
  return account;
}
