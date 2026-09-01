import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

export async function getSettings() {
  const existing = await prisma.appSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return existing;
  return prisma.appSettings.create({ data: { id: SINGLETON_ID } });
}

export async function isOnboarded() {
  const settings = await getSettings();
  return settings.onboardedAt != null;
}
