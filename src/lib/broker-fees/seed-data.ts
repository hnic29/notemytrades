/**
 * Default broker fee schedules — researched from each broker's own
 * pricing pages (or, where noted, cross-checked search summaries)
 * on 2026-09-01/02. Real commission structures are often tiered,
 * volume-discounted, or asymmetric between opening and closing a
 * position; the fields below collapse each broker down to one
 * representative per-side rate so the Take-Home calculator can apply
 * it uniformly. Every simplification made in doing that is written
 * out in `notes` so a user can judge for themselves, and `sourceUrl`
 * / `feesAsOf` let them verify against the broker's current page —
 * pricing changes, this is a starting estimate, not a guarantee.
 */
export type SeedBrokerProfile = {
  name: string;
  perContractFeeFutures: number | null;
  perContractFeeOptions: number | null;
  perShareFeeStock: number | null;
  minFeePerOrder: number | null;
  monthlyPlatformFee: number | null;
  sourceUrl: string | null;
  feesAsOf: string; // ISO date
  notes: string;
};

export const DEFAULT_BROKER_PROFILES: SeedBrokerProfile[] = [
  {
    name: "NinjaTrader",
    perContractFeeFutures: 0.39,
    perContractFeeOptions: null,
    perShareFeeStock: null,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: "https://ninjatrader.com/pricing/commissions/",
    feesAsOf: "2026-09-01",
    notes:
      "Free plan $0.39/side shown here. Monthly plan $0.20/side, Lifetime plan $0.09/side on micros — pick whichever plan you're actually on. Exchange/NFA/clearing pass-through fees apply on top, roughly $0.30–$1.00/round-trip depending on product, not included in this rate. ⚠️ Lowest-confidence entry in this list — the live pricing page didn't return a readable rate table during research, so these numbers come from secondary sources only. Verify against ninjatrader.com before relying on this.",
  },
  {
    name: "Tradovate",
    perContractFeeFutures: 1.29,
    perContractFeeOptions: null,
    perShareFeeStock: null,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: "https://tradovate.zendesk.com/hc/en-us/articles/115015825708",
    feesAsOf: "2026-09-02",
    notes:
      "Free plan standard-contract rate shown here ($0.39/side on micros). Monthly plan ($99/mo): $0.99 standard / $0.29 micro per side. Lifetime plan ($1,499 one-time): $0.09/side on micros. Exchange/clearing/NFA fees separate, roughly $0.50–$1.50/round-turn.",
  },
  {
    name: "AMP Futures",
    perContractFeeFutures: 0.6,
    perContractFeeOptions: null,
    perShareFeeStock: null,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: "https://ampfutures.com/commissions",
    feesAsOf: "2026-09-01",
    notes:
      "Standard flat rate; volume discount down to $0.15/side above 10,000 contracts/month. MES example ≈$0.44/side all-in. Exchange/platform/routing/data fees are bundled into the quoted rate but vary $0.10–$2.00/side by product. $30 wire withdrawal fee not modeled here.",
  },
  {
    name: "Optimus Futures",
    perContractFeeFutures: 0.75,
    perContractFeeOptions: null,
    perShareFeeStock: null,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: "https://optimusfutures.com/futures-commissions/",
    feesAsOf: "2026-09-01",
    notes:
      "Standard-contract rate shown here; micros are $0.25/side. Both drop with volume — as low as $0.10/side standard, $0.05/side micro at high volume. Add ~$0.02/side NFA fee on top. No platform fees; CME Level 1 data is free at 10+ round-turns/month.",
  },
  {
    name: "Interactive Brokers (Futures)",
    perContractFeeFutures: 0.85,
    perContractFeeOptions: null,
    perShareFeeStock: null,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: null,
    feesAsOf: "2026-09-01",
    notes:
      "IBKR Pro's base execution fee only — real all-in cost is meaningfully higher once exchange fees are added, and varies a lot by product (e.g. ES ≈$2.24/side all-in: $0.85 execution + $1.38 exchange; E7/Micro Euro ≈$1.36/side: $0.50 + $0.85 + $0.01 reg). Treat this as a floor, not the real number, until you check ibkr.com for your specific product. Not independently re-verified against IBKR's own futures pricing page this pass.",
  },
  {
    name: "TradeStation (FuturesPlus)",
    perContractFeeFutures: 1.75,
    perContractFeeOptions: null,
    perShareFeeStock: null,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: "https://www.tradestation.com/futures-pricing-disclosures/",
    feesAsOf: "2026-09-02",
    notes:
      "Standard per-contract, per-side rate. A lower micro-contract rate (previously reported around $0.50/contract) could not be reconfirmed this pass — don't rely on it without checking tradestation.com directly. Exchange/regulatory/overnight fees apply separately.",
  },
  {
    name: "Interactive Brokers (Stocks/Options)",
    perContractFeeFutures: null,
    perContractFeeOptions: 0.65,
    perShareFeeStock: 0,
    minFeePerOrder: 1,
    monthlyPlatformFee: null,
    sourceUrl: "https://www.interactivebrokers.com/en/pricing/commissions-options.php",
    feesAsOf: "2026-09-02",
    notes:
      "IBKR Lite: $0 stock/ETF. Options $0.65/contract with a $1 minimum per order, for your first 1,000 contracts/month — after that (or on IBKR Pro) tiered pricing can drop as low as $0.15/contract at volume.",
  },
  {
    name: "Charles Schwab / thinkorswim",
    perContractFeeFutures: null,
    perContractFeeOptions: 0.65,
    perShareFeeStock: 0,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: null,
    feesAsOf: "2026-09-01",
    notes:
      "$0 stock/ETF, no base commission on options — $0.65/contract flat. Waived on buy-to-close orders priced ≤$0.05 and on exercise/assignment (not modeled). Broker-assisted trades are $32.95, not modeled here.",
  },
  {
    name: "tastytrade",
    perContractFeeFutures: 1,
    perContractFeeOptions: 0.5,
    perShareFeeStock: null,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: null,
    feesAsOf: "2026-09-01",
    notes:
      "Equity options are really $1.00/contract to OPEN and $0.00 to CLOSE (capped at $10/leg) — since this app charges the same per-side rate on both entry and exit, $0.50/contract is used here so a full round-turn still totals the real $1.00, rather than doubling it. Futures: $1.00/contract standard, $0.75/contract micro (shown here as standard, symmetric both sides). Options on futures: $1.25/contract both sides, not separately modeled.",
  },
  {
    name: "Fidelity",
    perContractFeeFutures: null,
    perContractFeeOptions: 0.65,
    perShareFeeStock: 0,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: null,
    feesAsOf: "2026-09-01",
    notes:
      "$0 stock/ETF, $0.65/contract options. +$0.50/contract surcharge applies to accounts flagged as \"Professional Options Trader\" — not modeled, this assumes standard retail status. Broker-assisted trades are $32.95, not modeled.",
  },
  {
    name: "E*TRADE",
    perContractFeeFutures: null,
    perContractFeeOptions: 0.65,
    perShareFeeStock: 0,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: null,
    feesAsOf: "2026-09-01",
    notes:
      "$0 stock/ETF, $0.65/contract options at the standard retail rate. Drops to $0.50/contract for accounts placing 30+ trades/quarter — not modeled here.",
  },
  {
    name: "Robinhood",
    perContractFeeFutures: null,
    perContractFeeOptions: 0.5,
    perShareFeeStock: 0,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: null,
    feesAsOf: "2026-09-01",
    notes:
      "$0 stock/ETF, $0.50/contract options standard (drops to $0.35/contract on Robinhood Gold — not modeled). A small regulatory pass-through, roughly $0.04/contract, applies on top and isn't itemized separately here.",
  },
  {
    name: "Webull",
    perContractFeeFutures: null,
    perContractFeeOptions: 0,
    perShareFeeStock: 0,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: null,
    feesAsOf: "2026-09-01",
    notes:
      "$0 stock/ETF and most options. Index options are the exception, at $0.50/contract plus a $0.10/contract surcharge on orders over 500 contracts — not modeled here since most trading isn't index options.",
  },
  {
    name: "Lightspeed Financial",
    perContractFeeFutures: null,
    perContractFeeOptions: 0.6,
    perShareFeeStock: 0.0045,
    minFeePerOrder: null,
    monthlyPlatformFee: 25,
    sourceUrl: "https://lightspeed.com/pricing-fees/stocks-etfs",
    feesAsOf: "2026-09-02",
    notes:
      "Per-share stock/ETF pricing from $0.0045/share; options from $0.60/contract, dropping to $0.20/contract above 100,000 contracts/month (not modeled). Accounts under $15,000 are subject to a $25/month account minimum, shown here as a reference-only platform fee — it's offset by actual commissions generated, not simply added on top. Per-order minimums of $0.50–$3.00 vary by platform and aren't modeled per-trade.",
  },
  {
    name: "SoFi Invest",
    perContractFeeFutures: null,
    perContractFeeOptions: 0,
    perShareFeeStock: 0,
    minFeePerOrder: null,
    monthlyPlatformFee: null,
    sourceUrl: "https://www.sofi.com/invest/pricing-and-rates/",
    feesAsOf: "2026-09-02",
    notes:
      "No SoFi-specific commission on stock/ETF or options trades. Standard industry-wide regulatory pass-through (SEC fee, FINRA TAF, Options Regulatory Fee) still applies but is a tiny, near-identical amount across every broker, so it isn't modeled here.",
  },
];
