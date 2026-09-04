"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type DrawingInput =
  | { type: "horizontal"; price: number }
  | { type: "vertical"; time: number }
  | { type: "text"; time: number; price: number; label: string }
  | {
      type: "trendline" | "ray" | "rectangle" | "fibonacci" | "arrow";
      time1: number;
      price1: number;
      time2: number;
      price2: number;
    };

export async function createDrawing(sessionId: string, input: DrawingInput) {
  const data =
    input.type === "horizontal"
      ? { sessionId, type: "horizontal" as const, price1: input.price }
      : input.type === "vertical"
        ? { sessionId, type: "vertical" as const, time1: input.time }
        : input.type === "text"
          ? { sessionId, type: "text" as const, time1: input.time, price1: input.price, label: input.label }
          : {
              sessionId,
              type: input.type,
              time1: input.time1,
              price1: input.price1,
              time2: input.time2,
              price2: input.price2,
            };

  const drawing = await prisma.chartDrawing.create({ data });
  revalidatePath(`/backtesting/${sessionId}`);
  return drawing;
}

export async function clearDrawings(sessionId: string) {
  await prisma.chartDrawing.deleteMany({ where: { sessionId } });
  revalidatePath(`/backtesting/${sessionId}`);
}
