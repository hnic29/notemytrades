"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type DrawingInput =
  | { type: "horizontal"; price: number }
  | { type: "trendline"; time1: number; price1: number; time2: number; price2: number };

export async function createDrawing(sessionId: string, input: DrawingInput) {
  const drawing = await prisma.chartDrawing.create({
    data:
      input.type === "horizontal"
        ? { sessionId, type: "horizontal", price1: input.price }
        : {
            sessionId,
            type: "trendline",
            time1: input.time1,
            price1: input.price1,
            time2: input.time2,
            price2: input.price2,
          },
  });
  revalidatePath(`/backtesting/${sessionId}`);
  return drawing;
}

export async function clearDrawings(sessionId: string) {
  await prisma.chartDrawing.deleteMany({ where: { sessionId } });
  revalidatePath(`/backtesting/${sessionId}`);
}
