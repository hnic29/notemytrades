import { prisma } from "@/lib/prisma";

export async function listFolders() {
  return prisma.folder.findMany({ orderBy: { name: "asc" } });
}

export async function listNotes(folderId?: string | null) {
  return prisma.note.findMany({
    where: folderId === undefined ? {} : { folderId },
    include: { tags: { include: { tag: true } }, trade: { select: { id: true, symbol: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getNote(id: string) {
  return prisma.note.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, trade: { select: { id: true, symbol: true } } },
  });
}

export async function getNoteByShareSlug(slug: string) {
  return prisma.note.findUnique({
    where: { shareSlug: slug },
    include: { tags: { include: { tag: true } } },
  });
}

export async function listTemplates() {
  return prisma.noteTemplate.findMany({ orderBy: { createdAt: "asc" } });
}
