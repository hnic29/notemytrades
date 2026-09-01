"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries/settings";
import { chatComplete } from "@/lib/ai/client";

const SINGLETON_ID = "singleton";

export async function updateAiSettings(input: {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
}) {
  await getSettings(); // ensure the row exists
  await prisma.appSettings.update({
    where: { id: SINGLETON_ID },
    data: {
      aiBaseUrl: input.aiBaseUrl.trim() || null,
      aiApiKey: input.aiApiKey.trim() || null,
      aiModel: input.aiModel.trim() || null,
    },
  });
  revalidatePath("/settings");
}

export async function testAiConnection(): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const text = await chatComplete([
      { role: "user", content: "Reply with a single short sentence confirming you can hear this." },
    ]);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export async function markOnboarded() {
  await getSettings();
  await prisma.appSettings.update({
    where: { id: SINGLETON_ID },
    data: { onboardedAt: new Date() },
  });
  revalidatePath("/", "layout");
}
