"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries/settings";
import { DEFAULT_BROKER_PROFILES } from "@/lib/broker-fees/seed-data";

const SINGLETON_ID = "singleton";

/** Upserts the researched default broker profiles by name — safe to
 * call repeatedly (e.g. on every Take-Home page load) since it never
 * touches a profile a user has since customized under the same name,
 * it only creates missing ones and refreshes the shipped defaults. */
export async function seedDefaultBrokerProfiles() {
  await prisma.$transaction(
    DEFAULT_BROKER_PROFILES.map((p) =>
      prisma.brokerFeeProfile.upsert({
        where: { name: p.name },
        create: {
          name: p.name,
          isCustom: false,
          perContractFeeFutures: p.perContractFeeFutures,
          perContractFeeOptions: p.perContractFeeOptions,
          perShareFeeStock: p.perShareFeeStock,
          minFeePerOrder: p.minFeePerOrder,
          monthlyPlatformFee: p.monthlyPlatformFee,
          sourceUrl: p.sourceUrl,
          feesAsOf: new Date(p.feesAsOf),
          notes: p.notes,
        },
        update: {
          isCustom: false,
          perContractFeeFutures: p.perContractFeeFutures,
          perContractFeeOptions: p.perContractFeeOptions,
          perShareFeeStock: p.perShareFeeStock,
          minFeePerOrder: p.minFeePerOrder,
          monthlyPlatformFee: p.monthlyPlatformFee,
          sourceUrl: p.sourceUrl,
          feesAsOf: new Date(p.feesAsOf),
          notes: p.notes,
        },
      }),
    ),
  );
}

export type BrokerProfileInput = {
  name: string;
  perContractFeeFutures: number | null;
  perContractFeeOptions: number | null;
  perShareFeeStock: number | null;
  minFeePerOrder: number | null;
  monthlyPlatformFee: number | null;
  notes: string | null;
};

export async function createCustomBrokerProfile(input: BrokerProfileInput) {
  const profile = await prisma.brokerFeeProfile.create({
    data: { ...input, isCustom: true, sourceUrl: null, feesAsOf: null },
  });
  revalidatePath("/take-home");
  return profile;
}

export async function updateCustomBrokerProfile(id: string, input: BrokerProfileInput) {
  const existing = await prisma.brokerFeeProfile.findUniqueOrThrow({ where: { id } });
  if (!existing.isCustom) throw new Error("Only custom broker profiles can be edited.");
  const profile = await prisma.brokerFeeProfile.update({ where: { id }, data: input });
  revalidatePath("/take-home");
  return profile;
}

export async function deleteCustomBrokerProfile(id: string) {
  const existing = await prisma.brokerFeeProfile.findUniqueOrThrow({ where: { id } });
  if (!existing.isCustom) throw new Error("Only custom broker profiles can be deleted.");
  const settings = await getSettings();
  await prisma.$transaction([
    ...(settings.selectedBrokerProfileId === id
      ? [prisma.appSettings.update({ where: { id: SINGLETON_ID }, data: { selectedBrokerProfileId: null } })]
      : []),
    prisma.brokerFeeProfile.delete({ where: { id } }),
  ]);
  revalidatePath("/take-home");
}

export async function selectBrokerProfile(id: string | null) {
  await getSettings();
  await prisma.appSettings.update({ where: { id: SINGLETON_ID }, data: { selectedBrokerProfileId: id } });
  revalidatePath("/take-home");
}

export async function setTaxSetAsidePct(pct: number | null) {
  await getSettings();
  await prisma.appSettings.update({
    where: { id: SINGLETON_ID },
    data: { taxSetAsidePct: pct != null && Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : null },
  });
  revalidatePath("/take-home");
}
