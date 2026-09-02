import type { RuleGroup } from "@/lib/queries/strategies";

export type AssetClass = "stock" | "option" | "futures" | "forex" | "crypto" | "mixed";

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  stock: "Stocks",
  option: "Options",
  futures: "Futures",
  forex: "Forex",
  crypto: "Crypto",
  mixed: "Any Market",
};

export type StrategyTemplate = {
  slug: string;
  name: string;
  assetType: AssetClass;
  description: string;
  rules: RuleGroup[];
};

/**
 * Starter playbooks built from well-known, generic trading concepts —
 * a starting point to edit, not a claim that any of these are
 * profitable as written. Picking one and tweaking it beats starting
 * every strategy from a blank rules list.
 */
export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    slug: "opening-range-breakout",
    name: "Opening Range Breakout",
    assetType: "stock",
    description:
      "Trade the break of the first 5-15 minutes' high/low once the market has picked a direction for the day.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Mark the high and low of the first 5-15 minutes after the open",
          "Enter long on a break above the range high with rising volume, or short on a break below the range low",
          "Skip the setup if the first candle is unusually wide (already trended, no range to break)",
        ],
      },
      {
        group: "Exit Rules",
        rules: [
          "Initial stop just inside the opposite side of the opening range",
          "Take partial profit at 1R, trail the remainder behind the developing swing structure",
        ],
      },
      {
        group: "Risk Management",
        rules: ["Risk no more than 1% of account per trade", "No new entries after two losers on this setup today"],
      },
    ],
  },
  {
    slug: "ema-trend-pullback",
    name: "EMA Trend Pullback",
    assetType: "stock",
    description: "Buy shallow pullbacks to a rising short-term EMA while the higher timeframe trend stays up.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Higher timeframe (daily or 1h) trend is up: price above its 50-period EMA, EMA itself rising",
          "Wait for price to pull back to the 20 EMA on the entry timeframe without closing far below it",
          "Enter on the first bullish reversal candle off the EMA",
        ],
      },
      {
        group: "Exit Rules",
        rules: [
          "Stop below the pullback's low",
          "Target a prior swing high, or trail behind the 20 EMA once price extends",
        ],
      },
      {
        group: "Risk Management",
        rules: ["Position size from a fixed % risk, not a fixed share count", "Stand aside once price closes below the 50 EMA"],
      },
    ],
  },
  {
    slug: "vwap-mean-reversion",
    name: "VWAP Mean Reversion",
    assetType: "stock",
    description: "Fade extended moves back toward VWAP in a range-bound, non-trending tape.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Confirm the day is range-bound, not trending (VWAP roughly flat, price oscillating around it)",
          "Enter when price stretches 1-2 standard deviations from VWAP and shows a reversal candle",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Target VWAP itself, take most of the position off there", "Stop beyond the extreme of the stretch"],
      },
      {
        group: "Risk Management",
        rules: ["Do not take this setup once a clear trend day is confirmed (VWAP sloping and price riding one side of it)"],
      },
    ],
  },
  {
    slug: "gap-and-go",
    name: "Gap and Go",
    assetType: "stock",
    description: "Momentum continuation on stocks gapping up on news with the first pullback as the entry.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Scan for stocks gapping 4%+ on above-average pre-market volume with a real catalyst",
          "Wait for the first 1-2 minute pullback after the open, enter on the resumption of the move",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Stop below the pullback low", "Scale out into strength; trail the rest as new highs form"],
      },
      {
        group: "Risk Management",
        rules: [
          "Reduce size on low-float names — moves are faster in both directions",
          "No chasing extended entries far from the pullback level",
        ],
      },
    ],
  },
  {
    slug: "small-cap-fade",
    name: "Small-Cap Overextension Fade",
    assetType: "stock",
    description: "Short exhausted spikes in low-float, high-volatility names once buying momentum visibly stalls.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Identify a low-float stock up 50%+ intraday on thinning volume",
          "Wait for a clear failed breakout or a sharp reversal candle at a new high before entering short",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Stop above the spike high", "Cover into the first strong flush, or trail once price breaks vwap"],
      },
      {
        group: "Risk Management",
        rules: [
          "Size down significantly — these names can squeeze violently against a short",
          "Only take the setup with a locate/borrow confirmed if trading live",
        ],
      },
    ],
  },
  {
    slug: "iv-crush-credit-spread",
    name: "Earnings IV Crush Credit Spread",
    assetType: "option",
    description: "Sell premium ahead of an earnings-driven implied volatility drop using a defined-risk credit spread.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Confirm implied volatility is elevated relative to its own 6-month range ahead of the earnings date",
          "Sell a credit spread (call or put, per directional bias) outside the expected move, expiring shortly after earnings",
        ],
      },
      {
        group: "Exit Rules",
        rules: [
          "Close for a profit once IV crushes post-earnings, typically the next session",
          "Predefine the max loss as the spread width minus credit received — never let it run past that",
        ],
      },
      {
        group: "Risk Management",
        rules: ["Never risk more per trade than you'd accept losing on every leg going against you", "Avoid stocks with erratic post-earnings gaps beyond the spread width"],
      },
    ],
  },
  {
    slug: "long-call-momentum",
    name: "Momentum Long Call/Put",
    assetType: "option",
    description: "Directional options entry on a confirmed intraday trend, sized and timed to limit theta bleed.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Underlying shows a clear intraday trend with volume confirmation",
          "Buy near-the-money options with enough days to expiration to absorb normal chop (avoid 0DTE unless the plan explicitly allows it)",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Take profit into strength rather than holding for a home run", "Hard stop at a predefined % loss on the premium paid"],
      },
      {
        group: "Risk Management",
        rules: ["Cap single-trade risk at a fixed % of account, sized off the premium at risk, not contract count"],
      },
    ],
  },
  {
    slug: "breakout-retest-futures",
    name: "Breakout & Retest",
    assetType: "futures",
    description: "Enter on the retest of a broken key level once the initial breakout has confirmed with volume.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Mark a well-tested support/resistance level on the higher timeframe",
          "Wait for a volume-confirmed break of the level, then enter on the pullback retest holding as new support/resistance",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Stop back on the far side of the broken level", "Target the next major structural level, trail behind swing points beyond that"],
      },
      {
        group: "Risk Management",
        rules: ["Skip the retest entry if it takes too long to arrive — the setup has likely failed", "Reduce size around major scheduled news releases"],
      },
    ],
  },
  {
    slug: "london-session-breakout",
    name: "London Session Breakout",
    assetType: "forex",
    description: "Trade the breakout of the Asian session's range as London opens and liquidity picks up.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Mark the high/low of the Asian session range before London opens",
          "Enter on a clean break of the range in the direction of the higher-timeframe trend, avoiding counter-trend breaks",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Stop on the opposite side of the Asian range", "Target the next session's typical range extension, trail once in profit"],
      },
      {
        group: "Risk Management",
        rules: ["Avoid trading directly into a scheduled high-impact news release", "Stand aside on unusually narrow Asian ranges — little edge in the breakout"],
      },
    ],
  },
  {
    slug: "forex-range-reversion",
    name: "Range-Bound Mean Reversion",
    assetType: "forex",
    description: "Fade the edges of a well-established trading range in a pair showing no clear directional trend.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Confirm the pair has respected the same range boundaries multiple times recently",
          "Enter counter-trend at the range edge on a rejection candle, with confluence from an oscillator (e.g. RSI extreme)",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Target the opposite side of the range or the midpoint on the first attempt", "Stop just beyond the range boundary"],
      },
      {
        group: "Risk Management",
        rules: ["Exit the whole approach immediately once the range breaks cleanly — don't keep fading a new trend"],
      },
    ],
  },
  {
    slug: "crypto-trend-continuation",
    name: "Crypto Trend Continuation",
    assetType: "crypto",
    description: "Add to an established higher-timeframe uptrend on shallow pullbacks, riding volatility instead of fighting it.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Daily trend is clearly up: higher highs and higher lows, price above a rising 50-period MA",
          "Enter on a pullback to a prior breakout level or a rising moving average on a lower timeframe",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Stop below the pullback structure", "Scale out into round-number resistance, trail the runner"],
      },
      {
        group: "Risk Management",
        rules: [
          "Account for weekend/overnight volatility when sizing — crypto trades 24/7 with no circuit breakers",
          "Reduce size heading into major macro or exchange-specific news",
        ],
      },
    ],
  },
  {
    slug: "crypto-breakout-scalp",
    name: "Crypto Volatility Breakout Scalp",
    assetType: "crypto",
    description: "Short-timeframe breakout scalps on a consolidating pair right before a volatility expansion.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Identify a tight consolidation range after a sharp prior move (contraction before expansion)",
          "Enter on the break of the range with a clear volume/order-flow pickup",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Tight stop just inside the range", "Take profit quickly — this is a scalp, not a swing; don't let a winner round-trip"],
      },
      {
        group: "Risk Management",
        rules: ["Cap the number of scalp attempts per session to avoid overtrading a choppy tape"],
      },
    ],
  },
  {
    slug: "multi-timeframe-confluence",
    name: "Multi-Timeframe Trend Confirmation",
    assetType: "mixed",
    description: "A market-agnostic framework: only take a setup when the higher timeframe, entry timeframe, and momentum all agree.",
    rules: [
      {
        group: "Entry Rules",
        rules: [
          "Higher timeframe trend direction identified first — this sets the only direction you'll trade",
          "Entry timeframe shows a pullback or basing pattern in that same direction",
          "A momentum/volume signal confirms before entry, not just price structure alone",
        ],
      },
      {
        group: "Exit Rules",
        rules: ["Stop at the level that invalidates the higher-timeframe read", "Scale out at prior structure, trail the remainder with the entry-timeframe trend"],
      },
      {
        group: "Risk Management",
        rules: ["Walk away from the setup entirely if any one of the three timeframes disagrees", "One predefined risk % per trade, no exceptions for conviction"],
      },
    ],
  },
];

export function getTemplate(slug: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((t) => t.slug === slug);
}
