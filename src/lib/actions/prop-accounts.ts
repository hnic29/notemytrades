"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type PropAccountInput = {
  accountName: string;
  firmName: string;
  challengeType: string;
  phase: string;
  accountSize: number;
  profitTarget: number | null;
  maxDailyLoss: number | null;
  maxTotalDrawdown: number | null;
  startDate: string | null;
};

export async function createPropAccount(input: PropAccountInput) {
  const propAccount = await prisma.propAccount.create({
    data: {
      firmName: input.firmName,
      challengeType: input.challengeType || null,
      phase: input.phase,
      accountSize: input.accountSize,
      profitTarget: input.profitTarget,
      maxDailyLoss: input.maxDailyLoss,
      maxTotalDrawdown: input.maxTotalDrawdown,
      startDate: input.startDate ? new Date(input.startDate) : null,
      account: {
        create: {
          name: input.accountName,
          broker: input.firmName,
          assetType: "mixed",
          isPropFirm: true,
          startingBalance: input.accountSize,
        },
      },
    },
  });
  revalidatePath("/prop-accounts");
  return propAccount;
}

export async function updatePropAccount(id: string, input: PropAccountInput) {
  const propAccount = await prisma.propAccount.update({
    where: { id },
    data: {
      firmName: input.firmName,
      challengeType: input.challengeType || null,
      phase: input.phase,
      accountSize: input.accountSize,
      profitTarget: input.profitTarget,
      maxDailyLoss: input.maxDailyLoss,
      maxTotalDrawdown: input.maxTotalDrawdown,
      startDate: input.startDate ? new Date(input.startDate) : null,
      account: { update: { name: input.accountName, broker: input.firmName } },
    },
  });
  revalidatePath("/prop-accounts");
  revalidatePath(`/prop-accounts/${id}`);
  return propAccount;
}

export async function deletePropAccount(id: string) {
  const propAccount = await prisma.propAccount.findUniqueOrThrow({ where: { id } });
  // Deleting the underlying Account cascades to delete the PropAccount
  // row too (PropAccount.account has onDelete: Cascade).
  await prisma.account.delete({ where: { id: propAccount.accountId } });
  revalidatePath("/prop-accounts");
}

export async function setPhase(id: string, phase: string) {
  await prisma.propAccount.update({ where: { id }, data: { phase } });
  revalidatePath("/prop-accounts");
  revalidatePath(`/prop-accounts/${id}`);
}

export async function addTransaction(
  propAccountId: string,
  input: { type: string; amount: number; occurredAt: string; notes: string },
) {
  await prisma.propTransaction.create({
    data: {
      propAccountId,
      type: input.type,
      amount: input.amount,
      occurredAt: new Date(input.occurredAt),
      notes: input.notes || null,
    },
  });
  revalidatePath(`/prop-accounts/${propAccountId}`);
  revalidatePath("/prop-accounts");
}

export async function deleteTransaction(id: string, propAccountId: string) {
  await prisma.propTransaction.delete({ where: { id } });
  revalidatePath(`/prop-accounts/${propAccountId}`);
  revalidatePath("/prop-accounts");
}

export async function addPayout(
  propAccountId: string,
  input: { amount: number; requestedAt: string },
) {
  await prisma.propPayout.create({
    data: {
      propAccountId,
      amount: input.amount,
      requestedAt: new Date(input.requestedAt),
      status: "pending",
    },
  });
  revalidatePath(`/prop-accounts/${propAccountId}`);
}

export async function updatePayoutStatus(
  id: string,
  propAccountId: string,
  status: "pending" | "paid" | "denied",
) {
  await prisma.propPayout.update({
    where: { id },
    data: { status, paidAt: status === "paid" ? new Date() : null },
  });
  revalidatePath(`/prop-accounts/${propAccountId}`);
}

export async function deletePayout(id: string, propAccountId: string) {
  await prisma.propPayout.delete({ where: { id } });
  revalidatePath(`/prop-accounts/${propAccountId}`);
}
