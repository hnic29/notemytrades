import { prisma } from "@/lib/prisma";

export async function listSessions() {
  return prisma.backtestSession.findMany({
    include: { trades: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSession(id: string) {
  return prisma.backtestSession.findUnique({
    where: { id },
    include: { trades: { orderBy: { openedAt: "asc" } } },
  });
}

export async function getSessionByShareSlug(slug: string) {
  return prisma.backtestSession.findUnique({
    where: { shareSlug: slug },
    include: { trades: { orderBy: { openedAt: "asc" } } },
  });
}
