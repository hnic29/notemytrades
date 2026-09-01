"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeTradeMath, resolveClosedAt, type TradeSide } from "@/lib/trade-math";
import { getOrCreateBacktestAccount } from "@/lib/actions/accounts";
import type { Timeframe } from "@/lib/market-data/yahoo";

export async function createSession(input: {
  name: string;
  symbol: string;
  timeframe: Timeframe;
  startDate: string;
  endDate: string;
}) {
  const account = await getOrCreateBacktestAccount();
  const session = await prisma.backtestSession.create({
    data: {
      accountId: account.id,
      name: input.name || `${input.symbol} backtest`,
      symbol: input.symbol.toUpperCase(),
      timeframe: input.timeframe,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    },
  });
  revalidatePath("/backtesting");
  return session;
}

export async function deleteSession(id: string) {
  await prisma.backtestSession.delete({ where: { id } });
  revalidatePath("/backtesting");
}

export async function completeSession(id: string) {
  await prisma.backtestSession.update({ where: { id }, data: { status: "completed" } });
  revalidatePath(`/backtesting/${id}`);
}

export async function placeBacktestTrade(
  sessionId: string,
  input: {
    accountId: string;
    symbol: string;
    side: TradeSide;
    quantity: number;
    entryPrice: number;
    entryTime: string; // ISO
    stopLoss: number | null;
    profitTarget: number | null;
  },
) {
  const trade = await prisma.trade.create({
    data: {
      accountId: input.accountId,
      backtestSessionId: sessionId,
      isBacktest: true,
      symbol: input.symbol.toUpperCase(),
      assetType: "stock",
      side: input.side,
      status: "open",
      openedAt: new Date(input.entryTime),
      closedAt: null,
      quantity: input.quantity,
      avgEntryPrice: input.entryPrice,
      avgExitPrice: null,
      grossPnl: 0,
      netPnl: 0,
      stopLoss: input.stopLoss,
      profitTarget: input.profitTarget,
      source: "backtest",
      executions: {
        create: [
          {
            side: input.side === "long" ? "buy" : "sell",
            quantity: input.quantity,
            price: input.entryPrice,
            timestamp: new Date(input.entryTime),
            isEntry: true,
          },
        ],
      },
    },
  });
  revalidatePath(`/backtesting/${sessionId}`);
  return trade;
}

export async function closeBacktestTrade(
  tradeId: string,
  sessionId: string,
  input: { exitPrice: number; exitTime: string },
) {
  const trade = await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } });

  const math = computeTradeMath({
    side: trade.side as TradeSide,
    quantity: trade.quantity,
    multiplier: trade.multiplier,
    avgEntryPrice: trade.avgEntryPrice,
    avgExitPrice: input.exitPrice,
    fees: trade.fees,
    commissions: trade.commissions,
  });
  const closedAt = resolveClosedAt(trade.openedAt, new Date(input.exitTime), input.exitPrice);

  await prisma.$transaction([
    prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: "closed",
        avgExitPrice: input.exitPrice,
        closedAt,
        grossPnl: math.grossPnl,
        netPnl: math.netPnl,
        netRoi: math.netRoi,
      },
    }),
    prisma.execution.create({
      data: {
        tradeId,
        side: trade.side === "long" ? "sell" : "buy",
        quantity: trade.quantity,
        price: input.exitPrice,
        timestamp: new Date(input.exitTime),
        isEntry: false,
      },
    }),
  ]);
  revalidatePath(`/backtesting/${sessionId}`);
}

export async function deleteBacktestTrade(tradeId: string, sessionId: string) {
  await prisma.trade.delete({ where: { id: tradeId } });
  revalidatePath(`/backtesting/${sessionId}`);
}

export async function generateSessionShareLink(id: string) {
  const session = await prisma.backtestSession.findUniqueOrThrow({ where: { id } });
  if (session.shareSlug) return session.shareSlug;
  const slug = randomBytes(6).toString("hex");
  await prisma.backtestSession.update({ where: { id }, data: { shareSlug: slug } });
  revalidatePath(`/backtesting/${id}`);
  return slug;
}

export async function revokeSessionShareLink(id: string) {
  await prisma.backtestSession.update({ where: { id }, data: { shareSlug: null } });
  revalidatePath(`/backtesting/${id}`);
}
