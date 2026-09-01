"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function saveDailyNote(dateKey: string, text: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  await prisma.dailyNote.upsert({
    where: { date },
    update: { contentJson: text },
    create: { date, contentJson: text },
  });
  revalidatePath("/journal");
}
