"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function listAccounts() {
  return prisma.account.findMany({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
  });
}

/** Every account, including archived ones — for the Settings page,
 * where archiving/unarchiving needs to actually see what's hidden. */
export async function listAllAccounts() {
  return prisma.account.findMany({ orderBy: { createdAt: "asc" } });
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

/**
 * Case-insensitive, trimmed name collision check across every account
 * (archived ones too — an archived duplicate is still confusing if
 * it's ever unarchived, or just forgotten about). This is exactly the
 * gap that let a second "Main Account" get created silently and split
 * synced trades across two accounts without anyone noticing — see the
 * "trades tripled" incident this was added after.
 */
async function assertUniqueAccountName(name: string, excludeId?: string) {
  const trimmed = name.trim().toLowerCase();
  // SQLite's Prisma connector doesn't support `mode: "insensitive"`
  // (that's Postgres/MongoDB only) — the account list is always small
  // for a single-user app, so comparing in JS is simpler than fighting
  // SQLite collations.
  const accounts = await prisma.account.findMany({ select: { id: true, name: true, archived: true } });
  const clash = accounts.find((a) => a.id !== excludeId && a.name.trim().toLowerCase() === trimmed);
  if (clash) {
    throw new Error(
      `An account named "${name.trim()}" already exists${clash.archived ? " (archived)" : ""} — pick a different name, or use that existing account instead.`,
    );
  }
}

export async function createAccount(input: {
  name: string;
  broker?: string;
  assetType?: string;
  currency?: string;
  startingBalance?: number;
}) {
  await assertUniqueAccountName(input.name);
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

export async function updateAccount(
  id: string,
  input: {
    name: string;
    broker?: string;
    assetType?: string;
    currency?: string;
    startingBalance?: number;
  },
) {
  await assertUniqueAccountName(input.name, id);
  const account = await prisma.account.update({
    where: { id },
    data: {
      name: input.name,
      broker: input.broker || null,
      assetType: input.assetType || "mixed",
      currency: input.currency || "USD",
      startingBalance: input.startingBalance ?? 0,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/trades");
  revalidatePath("/dashboard");
  return account;
}

export async function setAccountArchived(id: string, archived: boolean) {
  await prisma.account.update({ where: { id }, data: { archived } });
  revalidatePath("/settings");
  revalidatePath("/trades");
  revalidatePath("/dashboard");
}

export async function deleteAccount(id: string) {
  await prisma.account.delete({ where: { id } });
  revalidatePath("/settings");
}
