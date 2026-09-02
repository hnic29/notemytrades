"use server";

import { AiError, chatComplete, isAiConfigured, type ChatMessage } from "@/lib/ai/client";
import { buildTradingContextSummary, TRADING_ASSISTANT_SYSTEM_PROMPT } from "@/lib/ai/context";
import { fetchReportTrades } from "@/lib/queries/reports";
import type { ReportFilters } from "@/lib/filters";
import { getSession } from "@/lib/queries/backtesting";
import { computeSummaryStats } from "@/lib/analytics/stats";
import { formatCurrency, formatPercent } from "@/lib/format";
import { BacktestRuleSchema, type BacktestRule } from "@/lib/backtesting/rule-schema";

export type AiResult = { ok: true; text: string } | { ok: false; error: string };

// Next.js redacts thrown Server Action error messages in production
// builds (a deliberate security default — only an opaque digest
// reaches the client). That's right for genuine bugs, but AiError
// conditions (not configured, endpoint unreachable, bad response) are
// expected, user-facing states we want the real message for — so
// every exported action here catches and returns a typed result
// instead of letting the error propagate and get swallowed.
async function safely(run: () => Promise<string>): Promise<AiResult> {
  try {
    return { ok: true, text: await run() };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

export async function checkAiStatus() {
  return { configured: await isAiConfigured() };
}

export async function askTradingAssistant(
  history: ChatMessage[],
  filters: ReportFilters = {},
): Promise<AiResult> {
  return safely(async () => {
    const trades = await fetchReportTrades(filters);
    const context = buildTradingContextSummary(trades);

    return chatComplete([
      { role: "system", content: `${TRADING_ASSISTANT_SYSTEM_PROMPT}\n\nContext:\n${context}` },
      ...history,
    ]);
  });
}

export async function generateReportInsight(filters: ReportFilters): Promise<AiResult> {
  return safely(async () => {
    const trades = await fetchReportTrades(filters);
    const context = buildTradingContextSummary(trades);

    return chatComplete([
      { role: "system", content: TRADING_ASSISTANT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Here is my trading performance for the currently selected filters:\n\n${context}\n\nWrite a short (2-4 sentence) narrative summary highlighting the most notable pattern or takeaway. Be specific and reference the actual numbers.`,
      },
    ]);
  });
}

export async function generateNoteAssist(
  currentText: string,
  instruction: "continue" | "improve" | "summarize",
): Promise<AiResult> {
  return safely(async () => {
    const prompts: Record<typeof instruction, string> = {
      continue:
        "Continue writing this trading journal note naturally, picking up where it left off. Write 1-3 more sentences.",
      improve:
        "Rewrite this trading journal note to be clearer and more concise, keeping the same meaning and facts. Don't invent details.",
      summarize: "Summarize this trading journal note in 1-2 sentences.",
    };

    return chatComplete([
      {
        role: "system",
        content:
          "You are a writing assistant for a trader's private journal notes. Match their voice, stay factual, and never invent trades, prices, or outcomes not present in the text.",
      },
      { role: "user", content: `${prompts[instruction]}\n\nNote so far:\n${currentText || "(empty)"}` },
    ]);
  });
}

export async function generateBacktestSummary(sessionId: string): Promise<AiResult> {
  return safely(async () => {
    const session = await getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const stats = computeSummaryStats(session.trades);
    const context =
      stats.closedTrades === 0
        ? "No closed trades in this backtesting session yet."
        : `${stats.closedTrades} trades, net P&L ${formatCurrency(stats.netPnl)}, win rate ${
            stats.winRate != null ? formatPercent(stats.winRate) : "n/a"
          }, profit factor ${stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "n/a"}.`;

    return chatComplete([
      { role: "system", content: TRADING_ASSISTANT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Summarize this backtesting session on ${session.symbol} (${session.timeframe}, ${session.startDate.toDateString()} to ${session.endDate.toDateString()}):\n\n${context}\n\nWrite 2-4 sentences.`,
      },
    ]);
  });
}

export type ParseRuleResult = { ok: true; rule: BacktestRule } | { ok: false; error: string };

const RULE_SCHEMA_PROMPT = `You translate a plain-English trading strategy description into a single structured JSON rule for a deterministic backtest engine. Respond with ONLY the JSON object — no prose, no markdown code fences.

The JSON must match exactly this shape:
{
  "side": "long" | "short",
  "entry": {
    "left": { "type": "price" | "ema" | "sma" | "rsi", "period"?: number },
    "comparison": "crosses_above" | "crosses_below" | "greater_than" | "less_than",
    "right": { "type": "price" | "ema" | "sma" | "rsi", "period"?: number } | { "type": "value", "value": number }
  },
  "exit": { "takeProfitPct"?: number, "stopLossPct"?: number },
  "positionSizing": { "type": "fixedQuantity", "quantity": number } | { "type": "riskPercent", "percent": number }
}

Rules you must follow:
- "period" is required for ema/sma/rsi, omitted entirely for "price".
- "exit" must include at least one of takeProfitPct or stopLossPct, as a plain percent number (e.g. 1 means 1%).
- positionSizing "riskPercent" REQUIRES exit.stopLossPct to also be set — pick "fixedQuantity" instead if the description gives no stop.
- This engine only supports ONE entry condition (a single comparison between two things) and percentage-based exits — no indicator-based exits, no multi-condition boolean logic, no chart-pattern or price-action jargon (ICT concepts, support/resistance zones, etc. have no representation here). If the description needs any of that, approximate it with the closest single-condition equivalent you can express in this shape rather than refusing.`;

/**
 * Translates a plain-English strategy description into the structured
 * rule shape src/lib/backtesting/rule-engine.ts can run — the AI's job
 * is only this translation step, never per-candle reasoning; every
 * candle after this is evaluated deterministically.
 */
export async function parseBacktestRule(description: string): Promise<ParseRuleResult> {
  try {
    const text = await chatComplete(
      [
        { role: "system", content: RULE_SCHEMA_PROMPT },
        { role: "user", content: description },
      ],
      { temperature: 0 },
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(text));
    } catch {
      return {
        ok: false,
        error: "The AI's response wasn't valid JSON — try describing the strategy more simply.",
      };
    }

    const result = BacktestRuleSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        error: `The AI produced a rule this engine can't run: ${result.error.issues[0]?.message ?? "invalid shape"}.`,
      };
    }
    return { ok: true, rule: result.data };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

/** Strips a ```json fence if the model added one despite instructions
 * not to — cheap defensive parsing rather than a strict rejection. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}
