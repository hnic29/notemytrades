"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

export async function createNote(input: {
  title: string;
  folderId: string | null;
  templateId?: string | null;
}) {
  let contentJson = EMPTY_DOC;
  if (input.templateId) {
    const template = await prisma.noteTemplate.findUnique({ where: { id: input.templateId } });
    if (template) contentJson = template.contentJson;
  }

  const note = await prisma.note.create({
    data: { title: input.title || "Untitled", folderId: input.folderId, contentJson },
  });
  revalidatePath("/notebook");
  return note;
}

export async function updateNote(
  id: string,
  input: { title?: string; contentJson?: string; fontSize?: number; tagNames?: string[] },
) {
  const note = await prisma.note.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.contentJson !== undefined ? { contentJson: input.contentJson } : {}),
      ...(input.fontSize !== undefined ? { fontSize: input.fontSize } : {}),
    },
  });

  if (input.tagNames) {
    await prisma.noteTag.deleteMany({ where: { noteId: id } });
    for (const raw of input.tagNames) {
      const name = raw.trim();
      if (!name) continue;
      const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
      await prisma.noteTag.upsert({
        where: { noteId_tagId: { noteId: id, tagId: tag.id } },
        update: {},
        create: { noteId: id, tagId: tag.id },
      });
    }
  }

  revalidatePath("/notebook");
  return note;
}

export async function deleteNote(id: string) {
  await prisma.note.delete({ where: { id } });
  revalidatePath("/notebook");
}

export async function createFolder(name: string, parentId: string | null) {
  const folder = await prisma.folder.create({ data: { name, parentId } });
  revalidatePath("/notebook");
  return folder;
}

export async function deleteFolder(id: string) {
  await prisma.note.updateMany({ where: { folderId: id }, data: { folderId: null } });
  await prisma.folder.delete({ where: { id } });
  revalidatePath("/notebook");
}

export async function moveNoteToFolder(noteId: string, folderId: string | null) {
  await prisma.note.update({ where: { id: noteId }, data: { folderId } });
  revalidatePath("/notebook");
}

export async function saveAsTemplate(name: string, contentJson: string, isDefault: boolean) {
  if (isDefault) {
    await prisma.noteTemplate.updateMany({ data: { isDefault: false }, where: {} });
  }
  const template = await prisma.noteTemplate.create({ data: { name, contentJson, isDefault } });
  revalidatePath("/notebook");
  return template;
}

export async function deleteTemplate(id: string) {
  await prisma.noteTemplate.delete({ where: { id } });
  revalidatePath("/notebook");
}

export async function generateNoteShareLink(id: string) {
  const note = await prisma.note.findUniqueOrThrow({ where: { id } });
  if (note.shareSlug) return note.shareSlug;
  const slug = randomBytes(6).toString("hex");
  await prisma.note.update({ where: { id }, data: { shareSlug: slug } });
  revalidatePath(`/notebook`);
  return slug;
}

export async function revokeNoteShareLink(id: string) {
  await prisma.note.update({ where: { id }, data: { shareSlug: null } });
  revalidatePath("/notebook");
}

export async function linkNoteToTrade(noteId: string, tradeId: string) {
  await prisma.trade.update({ where: { id: tradeId }, data: { noteId } });
  revalidatePath("/notebook");
  revalidatePath(`/trades/${tradeId}`);
}

export async function unlinkNoteFromTrade(tradeId: string) {
  await prisma.trade.update({ where: { id: tradeId }, data: { noteId: null } });
  revalidatePath("/notebook");
  revalidatePath(`/trades/${tradeId}`);
}

export async function searchTradesToLink(query: string) {
  if (!query.trim()) return [];
  return prisma.trade.findMany({
    where: { symbol: { contains: query.toUpperCase() } },
    select: { id: true, symbol: true, openedAt: true, netPnl: true, noteId: true },
    orderBy: { openedAt: "desc" },
    take: 10,
  });
}
