import { z } from "zod";

/**
 * Deliberately narrow: one entry condition (price or a single
 * indicator, compared to price/an indicator/a fixed value, by a cross
 * or a threshold) and one exit shape (%-based take-profit and/or
 * stop-loss only — no indicator-based exits, no multi-condition boolean
 * logic, no ICT jargon). This is what the AI translates plain English
 * into, and the only shape the deterministic rule engine can run.
 */
const IndicatorRef = z.object({
  type: z.enum(["price", "ema", "sma", "rsi"]),
  period: z.number().int().positive().optional(),
});

const ComparisonTarget = z.union([IndicatorRef, z.object({ type: z.literal("value"), value: z.number() })]);

export const BacktestRuleSchema = z
  .object({
    side: z.enum(["long", "short"]),
    entry: z.object({
      left: IndicatorRef,
      comparison: z.enum(["crosses_above", "crosses_below", "greater_than", "less_than"]),
      right: ComparisonTarget,
    }),
    exit: z
      .object({
        takeProfitPct: z.number().positive().optional(),
        stopLossPct: z.number().positive().optional(),
      })
      .refine((e) => e.takeProfitPct != null || e.stopLossPct != null, {
        message: "exit must set at least one of takeProfitPct or stopLossPct",
      }),
    positionSizing: z.union([
      z.object({ type: z.literal("fixedQuantity"), quantity: z.number().positive() }),
      z.object({ type: z.literal("riskPercent"), percent: z.number().positive() }),
    ]),
  })
  .refine((rule) => rule.positionSizing.type !== "riskPercent" || rule.exit.stopLossPct != null, {
    message: "riskPercent position sizing requires exit.stopLossPct to be set",
  });

export type BacktestRule = z.infer<typeof BacktestRuleSchema>;
export type IndicatorRefValue = z.infer<typeof IndicatorRef>;
