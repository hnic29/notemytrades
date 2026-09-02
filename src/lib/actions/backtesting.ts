"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeTradeMath, resolveClosedAt, type TradeSide } from "@/lib/trade-math";
import { getOrCreateBacktestAccount } from "@/lib/actions/accounts";
import { checkAutoBreakeven, evaluateOrderFill } from "@/lib/backtesting/order-engine";
import { getSessionCandles } from "@/lib/backtesting/session-candles";
import { buildBacktestTradeCreateData } from "@/lib/backtesting/trade-factory";
import { runRuleBacktest } from "@/lib/backtesting/rule-engine";
import { BacktestRuleSchema, type BacktestRule } from "@/lib/backtesting/rule-schema";
import type { Candle, Timeframe } from "@/lib/market-data/yahoo";

export async function createSession(input: {
  name: string;
  symbol: string;
  assetType: string;
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
      assetType: input.assetType,
      timeframe: input.timeframe,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
    },
  });
  revalidatePath("/backtesting");
  return session;
}

/**
 * Trade.backtestSessionId and BacktestOrder.sessionId have no explicit
 * onDelete, so Prisma defaults an optional relation to SetNull —
 * deleting the session alone would silently *detach* its trades/orders
 * rather than delete them, leaving orphans behind despite the confirm
 * dialog's "and all its trades" promise. Delete children first, in the
 * same transaction.
 */
export async function deleteSession(id: string) {
  await prisma.$transaction([
    prisma.backtestOrder.deleteMany({ where: { sessionId: id } }),
    prisma.trade.deleteMany({ where: { backtestSessionId: id } }),
    prisma.backtestSession.delete({ where: { id } }),
  ]);
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
    assetType: string;
    side: TradeSide;
    quantity: number;
    entryPrice: number;
    entryTime: string; // ISO
    stopLoss: number | null;
    profitTarget: number | null;
    autoBreakevenR: number | null;
  },
) {
  const trade = await prisma.trade.create({
    data: buildBacktestTradeCreateData({
      accountId: input.accountId,
      sessionId,
      symbol: input.symbol,
      assetType: input.assetType,
      side: input.side,
      quantity: input.quantity,
      entryPrice: input.entryPrice,
      entryTime: new Date(input.entryTime),
      stopLoss: input.stopLoss,
      profitTarget: input.profitTarget,
      autoBreakevenR: input.autoBreakevenR,
    }),
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

export async function placePendingOrder(
  sessionId: string,
  input: {
    symbol: string;
    side: TradeSide;
    orderType: "limit" | "stop";
    triggerPrice: number;
    quantity: number;
    stopLoss: number | null;
    profitTarget: number | null;
    autoBreakevenR: number | null;
  },
) {
  const order = await prisma.backtestOrder.create({
    data: {
      sessionId,
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      orderType: input.orderType,
      triggerPrice: input.triggerPrice,
      quantity: input.quantity,
      stopLoss: input.stopLoss,
      profitTarget: input.profitTarget,
      autoBreakevenR: input.autoBreakevenR,
    },
  });
  revalidatePath(`/backtesting/${sessionId}`);
  return order;
}

export async function cancelPendingOrder(orderId: string, sessionId: string) {
  await prisma.backtestOrder.update({ where: { id: orderId }, data: { status: "cancelled" } });
  revalidatePath(`/backtesting/${sessionId}`);
}

/**
 * Called once per newly-revealed replay candle (only when the client
 * knows there's something to evaluate — see BacktestWorkspace) to fill
 * any pending limit/stop orders and apply auto-breakeven to the open
 * trade, if any. At most one open position is allowed at a time,
 * matching the existing market-order flow's constraint.
 */
export async function evaluateCandleForSession(
  sessionId: string,
  accountId: string,
  assetType: string,
  candle: Candle,
): Promise<{ filledOrderIds: string[]; breakevenApplied: boolean }> {
  const [pendingOrders, openTrade] = await Promise.all([
    prisma.backtestOrder.findMany({ where: { sessionId, status: "pending" } }),
    prisma.trade.findFirst({ where: { backtestSessionId: sessionId, status: "open" } }),
  ]);

  const filledOrderIds: string[] = [];
  let breakevenApplied = false;
  const entryTime = new Date(candle.time * 1000);

  await prisma.$transaction(async (tx) => {
    let hasOpenPosition = openTrade != null;

    for (const order of pendingOrders) {
      if (hasOpenPosition) break;
      const result = evaluateOrderFill(
        {
          side: order.side as TradeSide,
          orderType: order.orderType as "limit" | "stop",
          triggerPrice: order.triggerPrice,
        },
        candle,
      );
      if (!result.filled) continue;

      const trade = await tx.trade.create({
        data: buildBacktestTradeCreateData({
          accountId,
          sessionId,
          symbol: order.symbol,
          assetType,
          side: order.side as TradeSide,
          quantity: order.quantity,
          entryPrice: result.fillPrice,
          entryTime,
          stopLoss: order.stopLoss,
          profitTarget: order.profitTarget,
          autoBreakevenR: order.autoBreakevenR,
        }),
      });
      await tx.backtestOrder.update({
        where: { id: order.id },
        data: { status: "filled", filledTradeId: trade.id },
      });
      filledOrderIds.push(order.id);
      hasOpenPosition = true;
    }

    if (openTrade && openTrade.autoBreakevenR != null) {
      const newStop = checkAutoBreakeven(
        {
          side: openTrade.side as TradeSide,
          avgEntryPrice: openTrade.avgEntryPrice,
          stopLoss: openTrade.stopLoss,
          autoBreakevenR: openTrade.autoBreakevenR,
        },
        candle,
      );
      if (newStop != null) {
        await tx.trade.update({ where: { id: openTrade.id }, data: { stopLoss: newStop } });
        breakevenApplied = true;
      }
    }
  });

  if (filledOrderIds.length > 0 || breakevenApplied) {
    revalidatePath(`/backtesting/${sessionId}`);
  }

  return { filledOrderIds, breakevenApplied };
}

/**
 * Runs an AI-parsed rule deterministically across the session's full
 * candle range and persists every resulting trade as a real Trade +
 * entry/exit Execution pair — built from the same
 * buildBacktestTradeCreateData factory manual and pending-order fills
 * use, so an AI-generated trade is indistinguishable in shape from one
 * placed by hand.
 */
export async function runAutoBacktest(
  sessionId: string,
  accountId: string,
  assetType: string,
  rule: BacktestRule,
): Promise<{ tradesCreated: number }> {
  // parseBacktestRule (src/lib/actions/ai.ts) already validates AI output
  // before the UI ever shows it to the user, but this action is itself a
  // Server Action reachable directly with any payload, bypassing that —
  // re-validate here, at the point the rule actually drives real trade
  // creation, rather than trusting the caller.
  const validRule = BacktestRuleSchema.parse(rule);

  const session = await prisma.backtestSession.findUniqueOrThrow({ where: { id: sessionId } });

  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  if (validRule.positionSizing.type === "riskPercent" && account.startingBalance <= 0) {
    throw new Error(
      "Set a starting balance above before running a risk-%-sized auto-backtest — quantity can't be sized from a $0 balance.",
    );
  }

  const candles = await getSessionCandles(session);
  if (candles.length === 0) {
    throw new Error("No candle data available for this session's symbol/timeframe/date range.");
  }

  const result = runRuleBacktest(candles, validRule, account.startingBalance);
  if (result.trades.length === 0) {
    return { tradesCreated: 0 };
  }

  await prisma.$transaction(
    result.trades.map((t) => {
      const entryTime = new Date(candles[t.entryIndex].time * 1000);
      const exitTime = new Date(candles[t.exitIndex].time * 1000);
      const math = computeTradeMath({
        side: t.side,
        quantity: t.quantity,
        multiplier: 1,
        avgEntryPrice: t.entryPrice,
        avgExitPrice: t.exitPrice,
        fees: 0,
        commissions: 0,
      });

      return prisma.trade.create({
        data: {
          ...buildBacktestTradeCreateData({
            accountId,
            sessionId,
            symbol: session.symbol,
            assetType,
            side: t.side,
            quantity: t.quantity,
            entryPrice: t.entryPrice,
            entryTime,
            stopLoss: null,
            profitTarget: null,
            autoBreakevenR: null,
          }),
          status: "closed",
          closedAt: exitTime,
          avgExitPrice: t.exitPrice,
          grossPnl: math.grossPnl,
          netPnl: math.netPnl,
          netRoi: math.netRoi,
          executions: {
            create: [
              {
                side: t.side === "long" ? "buy" : "sell",
                quantity: t.quantity,
                price: t.entryPrice,
                timestamp: entryTime,
                isEntry: true,
              },
              {
                side: t.side === "long" ? "sell" : "buy",
                quantity: t.quantity,
                price: t.exitPrice,
                timestamp: exitTime,
                isEntry: false,
              },
            ],
          },
        },
      });
    }),
  );

  revalidatePath(`/backtesting/${sessionId}`);
  return { tradesCreated: result.trades.length };
}

/** Thin wrapper so the backtesting UI can set the shared "Backtesting"
 * account's starting balance in-context — risk-% sizing is unusable
 * while it's stuck at the $0 default and Settings was the only place
 * to change it before this. */
export async function setBacktestStartingBalance(accountId: string, startingBalance: number) {
  await prisma.account.update({ where: { id: accountId }, data: { startingBalance } });
  revalidatePath("/backtesting");
}

/**
 * Fetches a full (non-replay-clipped) candle set for the session's
 * symbol/date-range at a different bar interval, for the chart's
 * timeframe switcher — a read-only "look at a higher/lower timeframe
 * for context" view. Deliberately doesn't touch the session's own
 * `timeframe` field or its trades: replay position, pending orders,
 * and auto-breakeven all stay anchored to the session's native
 * timeframe regardless of what the chart is currently displaying.
 */
export async function getContextCandles(
  symbol: string,
  assetType: string,
  timeframe: Timeframe,
  startDate: string,
  endDate: string,
): Promise<Candle[]> {
  return getSessionCandles({
    symbol,
    assetType,
    timeframe,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });
}
