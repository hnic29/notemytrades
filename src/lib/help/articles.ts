export type HelpArticle = {
  slug: string;
  title: string;
  section: string;
  summary: string;
  body: string[];
};

/**
 * Plain, hand-written content — not MDX or a database table. Single-
 * user, static, and small enough (a few dozen entries) that a typed
 * array is simpler than wiring up a content pipeline for it. Lines
 * starting with "- " render as a bullet in the article page.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    section: "Getting Started",
    summary: "A configurable home screen of widgets summarizing recent performance.",
    body: [
      "The Dashboard is a grid of widgets — net P&L, win rate, profit factor, average win/loss, current streak, drawdown, a calendar heatmap, and a trade score — pulled from your live (non-backtest) trades.",
      "Widgets can be resized (small/medium/large) and reordered; the layout is saved so it stays the way you left it.",
      "This is the fastest place to answer \"how am I doing lately\" without digging into Reports.",
    ],
  },
  {
    slug: "daily-journal",
    title: "Daily Journal",
    section: "Getting Started",
    summary: "One free-form note per calendar day for pre-market plans, session recaps, or lessons.",
    body: [
      "The Daily Journal gives every date its own note, independent of any specific trade — useful for a morning game plan, an end-of-day recap, or general reflections that don't belong to one trade.",
      "Navigate by date; each day's entry saves automatically as you type.",
    ],
  },
  {
    slug: "trade-log",
    title: "Trade Log",
    section: "Journaling",
    summary: "The full list of your live trades — add, edit, import, tag, split, merge, and export.",
    body: [
      "The Trade Log lists every live (non-backtest) trade with sortable columns you can show or hide. Filter by account or symbol.",
      "- Add a trade manually, or import a CSV export from your broker (TradingView, thinkorswim, MT4/MT5, and generic formats are recognized).",
      "- Sync straight from TradingView Desktop's Paper Trading — see Settings: TradingView Desktop Sync.",
      "- Select multiple trades to bulk-tag, transfer to another account, or delete.",
      "- Split a trade's quantity into two, or merge several trades into one (same account/symbol/side) when a broker export double-counted partial fills.",
      "- Export the current view to CSV.",
      "- Open any trade to see its detail page: entry/exit chart, tags, a quick note, a linked Notebook entry if any, and a full candle-by-candle replay of that specific trade.",
    ],
  },
  {
    slug: "notebook",
    title: "Notebook",
    section: "Journaling",
    summary: "Rich-text notes organized into folders, optionally linked to a specific trade.",
    body: [
      "The Notebook holds full rich-text documents (not just the one-line quick note on a trade) — think structured playbooks, screenshots-and-analysis writeups, or a running trading journal longer than a daily note.",
      "Organize notes into folders, start from a template, and adjust the editor's font size to taste.",
      "Any note can be linked to a specific trade from the note's editor panel (search by symbol) — once linked, the trade's detail page shows a link back to that note.",
    ],
  },
  {
    slug: "reports-overview",
    title: "Reports: Overview",
    section: "Analysis",
    summary: "The main performance dashboard: summary stats, an AI insight, equity curve, and a calendar.",
    body: [
      "The Overview tab shows headline stat cards (Net P&L, Win Rate, Profit Factor, Closed Trades), a dense two-column stats table (expectancy, average hold time, best/worst month, day-streak records, and more), an AI-generated narrative insight, an equity curve, a monthly calendar heatmap, and weekly/monthly rollup tables.",
      "Every Reports tab shares the same filter bar at the top (account and tag filters) and the same date-range picker, so a filter you set here carries across the other tabs.",
    ],
  },
  {
    slug: "reports-day-time",
    title: "Reports: Day & Time",
    section: "Analysis",
    summary: "Performance broken down by day of week and hour of day.",
    body: [
      "Shows win rate and P&L grouped by the day of the week and the hour of the day your trades closed — useful for spotting whether you're actually better in the morning, or worse on Mondays, than you assume.",
    ],
  },
  {
    slug: "reports-symbol",
    title: "Reports: Symbol",
    section: "Analysis",
    summary: "Performance grouped by traded symbol.",
    body: [
      "Ranks every symbol you've traded by net P&L, with win rate and trade count alongside — quickly shows which tickers are actually carrying your account and which are quietly bleeding it.",
    ],
  },
  {
    slug: "reports-win-loss",
    title: "Reports: Win vs Losses",
    section: "Analysis",
    summary: "A distribution of trade outcomes by P&L size.",
    body: [
      "Buckets your closed trades into a P&L histogram so you can see the shape of your wins and losses, not just their averages — a strategy with a 90% win rate can still be a net loser if the 10% are large enough.",
    ],
  },
  {
    slug: "reports-tags",
    title: "Reports: Tags",
    section: "Analysis",
    summary: "Performance grouped by the tags you've attached to trades.",
    body: [
      "Groups trades by tag (a trade with multiple tags counts toward each), ranked by net P&L — the fastest way to answer \"is 'revenge-trade' actually costing me money\" with numbers instead of a feeling.",
      "Tags are freeform: type any comma-separated label when adding or editing a trade, or bulk-add one tag to several selected trades from the Trade Log.",
    ],
  },
  {
    slug: "reports-playbook",
    title: "Reports: Playbook",
    section: "Analysis",
    summary: "Performance grouped by assigned Strategy.",
    body: [
      "Groups trades by the Strategy (playbook) assigned to them, so you can compare setups against each other directly — see Strategies below for how a trade gets assigned to one.",
    ],
  },
  {
    slug: "reports-risk",
    title: "Reports: Risk",
    section: "Analysis",
    summary: "Planned risk, reward-to-risk, R-multiple, and drawdown.",
    body: [
      "Covers trades that had a stop-loss set at entry: average dollars risked per trade, average planned reward-to-risk ratio, and average realized R-multiple (actual P&L divided by planned risk).",
      "Also shows the account's maximum drawdown with a chart of the drawdown series over time.",
    ],
  },
  {
    slug: "reports-options",
    title: "Reports: Options",
    section: "Analysis",
    summary: "Options-specific performance breakdowns.",
    body: [
      "Filters and groups specifically for options trades (assetType \"option\"), where the 100x contract multiplier and expiration-driven behavior make plain P&L comparisons to stocks/futures misleading.",
    ],
  },
  {
    slug: "reports-compare",
    title: "Reports: Compare",
    section: "Analysis",
    summary: "Side-by-side comparison across accounts.",
    body: [
      "Puts two or more accounts' stats side by side — useful for comparing a funded prop account against your personal account, or one broker's execution against another's.",
    ],
  },
  {
    slug: "strategies",
    title: "Strategies",
    section: "Analysis",
    summary: "Playbooks with entry/exit rules, assignable to trades, plus a missed-trades log.",
    body: [
      "A Strategy is a named playbook with a rule checklist (grouped rule sets, e.g. \"Entry\" / \"Exit\" / \"Management\") and an optional asset class. Assign a strategy to a trade to track how that specific setup performs (see Reports: Playbook).",
      "Don't start from a blank page — see Strategy Templates below for ready-made playbooks you can pick and tweak.",
      "Log a \"missed trade\" against a strategy — a setup that fired but you didn't take — to see what a playbook's real opportunity cost looks like, not just the trades you actually placed.",
      "Strategies can be shared via a read-only public link, same as trades and backtesting sessions.",
    ],
  },
  {
    slug: "strategy-templates",
    title: "Strategy Templates",
    section: "Analysis",
    summary: "Ready-to-run starter playbooks, filterable by asset class — pick one, tweak it, save it.",
    body: [
      "From the Strategies page, click \"Browse Templates\" (or the link on the empty state if you have none yet) to open a gallery of starter playbooks, filterable by asset class (Stocks, Options, Futures, Forex, Crypto, or Any Market).",
      "Each template has a name, a short description of the idea, and a full rule checklist (Entry / Exit / Risk Management) already filled in — built from well-known, generic trading concepts as a starting point, not a guarantee that any of them are profitable as written.",
      "Click \"Use Template\" on any card and it opens the New Strategy form pre-filled with that template's name, asset class, description, and rules — every field is editable before you save, so \"tweak the details\" means exactly that: rename it, add or remove rules, change the asset class, then Create Strategy to save your own copy.",
      "A template only pre-fills the form — nothing is saved until you submit it, and creating your own strategy from scratch (New Strategy) always remains an option if none of the templates fit.",
    ],
  },
  {
    slug: "progress-tracker",
    title: "Progress Tracker",
    section: "Journaling",
    summary: "Custom trading rules you check off per-trade or per-day, with pass/fail history.",
    body: [
      "Define rules you want to hold yourself to (\"waited for confirmation candle\", \"risked under 1%\", \"no trading after 2 losses\") — each rule is either per-trade or daily.",
      "Mark each one passed or failed as you go; the tracker keeps a history so you can see whether you're actually getting more disciplined over time, not just whether today felt disciplined.",
    ],
  },
  {
    slug: "prop-accounts",
    title: "Prop Accounts",
    section: "Journaling",
    summary: "Tracks a prop-firm challenge/verification/funded account's rules, fees, and payouts.",
    body: [
      "Attach prop-firm details to an Account: firm name, challenge type (1-step, 2-step, instant, funded), current phase, profit target, max daily loss, and max total drawdown.",
      "Log fees, deposits, resets, and adjustments as transactions, and track payout requests through pending/paid/denied.",
      "This is bookkeeping only — it doesn't pull live data from the prop firm; TradingView Desktop Sync (below) is the only automatic sync in the app, and it's for Paper Trading, not a prop firm's platform.",
    ],
  },
  {
    slug: "backtesting",
    title: "Backtesting & Replay",
    section: "Backtesting",
    summary: "Practice trading against historical candles, with playback, an order panel, and full analytics.",
    body: [
      "Create a session by choosing a symbol, asset type (stock/crypto/forex), timeframe, and date range. Historical candles come from Yahoo Finance's free feed — intraday history is limited to roughly the last few days to a couple of years depending on the timeframe (shown when you pick one), and there's no true tick-level data.",
      "Step or auto-play through the session candle by candle. At any point you can:",
      "- Place a market order (fills instantly at the current candle's close), or a limit/stop pending order that sits until a later candle triggers it — see Order Panel & Risk Sizing.",
      "- Size a trade by a fixed quantity or by risk-% of your starting balance — see Order Panel & Risk Sizing for how to set that balance.",
      "- Review deep analytics on the session so far — see Backtest Analytics.",
      "- Tag and journal a backtest trade exactly like a live one — see Journaling Backtest Trades.",
      "- Describe a simple strategy in plain English and run it automatically across the whole date range — see AI Auto-Backtesting.",
      "Mark a session Completed when you're done, export its trades to CSV, or generate a public read-only share link. Deleting a session deletes its trades and any pending orders with it.",
      "Every backtest trade lives in the same Trade table as a live one (flagged isBacktest) — it never appears in the live Trade Log, but it fully supports tags, a quick note, replay, and CSV export like any other trade.",
    ],
  },
  {
    slug: "ai-insights",
    title: "AI Insights",
    section: "AI",
    summary: "A chat assistant with context on your trades, plus AI-generated report summaries.",
    body: [
      "AI Insights is a chat interface that has your (filtered) trade history as context — ask it to spot patterns, explain a stretch of performance, or suggest what to look at next.",
      "AI-generated one-off summaries appear elsewhere too: a narrative insight on the Reports Overview, a note-writing assistant in the Notebook, and a backtesting session summary — all use the same AI connection configured in Settings.",
      "Requires an AI endpoint configured in Settings first (see below) — every AI feature shows a clear \"not configured\" state instead of a broken button until then.",
    ],
  },
  {
    slug: "settings",
    title: "Settings",
    section: "Settings",
    summary: "AI connection, accounts, data export/reset, and TradingView Desktop sync.",
    body: [
      "- AI Setup: point the app at any OpenAI-compatible /chat/completions endpoint (a local model runner like Ollama, or a router like Omniroute) — base URL, API key, and model. Settings here override the AI_BASE_URL/AI_API_KEY/AI_MODEL environment variables without needing a restart.",
      "- Accounts: create, edit, and archive trading accounts (name, broker, asset type, currency, starting balance). The backtesting feature auto-creates its own dedicated \"Backtesting\" account so backtest trades never mix into a real account's balance.",
      "- Data: export all your data, or run a guarded full reset that wipes everything (confirmation required — this cannot be undone).",
      "- TradingView Desktop Sync — see its own article below.",
      "This app is self-hosted and single-user by design: there's no login, no subscription, and no multi-tenant data separation.",
    ],
  },
  {
    slug: "settings-tradingview-sync",
    title: "Settings: TradingView Desktop Sync",
    section: "Settings",
    summary: "Import Paper Trading fills straight from a running TradingView Desktop app.",
    body: [
      "TradingView Desktop must be launched with remote debugging enabled (--remote-debugging-port, default 9222) for the app to read its Paper Trading data over Chrome DevTools Protocol.",
      "From Settings: set the port if 9222 is already in use by something else, click Launch TradingView to start it correctly, or Test Connection to verify it's reachable.",
      "Once connected, syncing pulls every fill Paper Trading remembers, pairs them the same way the CSV importer does, and adds whatever isn't already in your journal — safe to click repeatedly since duplicates are always skipped.",
      "If the test fails: quit TradingView Desktop completely (including the tray icon), then use Launch TradingView here rather than opening it normally, since the remote-debugging flag only takes effect at launch.",
    ],
  },
  {
    slug: "backtesting-orders",
    title: "Backtesting: Order Panel & Risk Sizing",
    section: "Backtesting",
    summary: "Market, limit, and stop orders, risk-% position sizing, and auto-breakeven.",
    body: [
      "The order panel supports three order types: Market (fills instantly at the current candle's close), Limit, and Stop. A limit or stop order becomes a pending order that sits until a later candle's price range reaches its trigger — at most one position is open at a time, so a pending order won't fill while a position is already open.",
      "Because the free candle data has no intrabar (tick) detail, a fill that happens mid-candle is modeled conservatively: if price gapped past the trigger on the candle's open, the fill is priced at that open rather than exactly at the trigger.",
      "Quantity can be typed directly, or sized from a risk-% preset (0.5% to 5%) once a stop-loss is set — the preset computes quantity from your risk-% of the account's starting balance divided by the per-share risk. Set that starting balance from the control above the order panel; it defaults to $0, which disables risk-% sizing until you set it.",
      "Auto-breakeven: set a target R-multiple and the trade's stop automatically moves to your entry price once unrealized profit reaches that multiple of your original risk, checked once per candle as the replay advances.",
      "Pending orders you no longer want can be cancelled from the Pending Orders panel above the order form.",
    ],
  },
  {
    slug: "backtesting-analytics",
    title: "Backtesting: Analytics",
    section: "Backtesting",
    summary: "Sharpe/Sortino/Calmar, expectancy, R-multiple, drawdown, best trade times, and CSV export.",
    body: [
      "Beyond the basic Net P&L / Win Rate / Profit Factor tiles, a session shows: expectancy, average realized R-multiple, maximum drawdown, and — when the session has at least 5 distinct trading days of closed trades and a starting balance set — Sharpe, Sortino, and Calmar ratios.",
      "Sharpe and Sortino here are computed on the session's *daily* realized P&L (as a fraction of starting balance), risk-free rate assumed 0, annualized with the standard √252 factor — the same methodology and granularity a textbook Sharpe ratio uses, so these are comparable across your own backtest sessions. They read null (—) rather than a misleading number when there isn't enough daily history to compute yet.",
      "Calmar is the session's annualized return divided by its maximum drawdown — reads as null when there's no drawdown to divide by (an all-winning session, for instance).",
      "When you have both long and short trades in a session, their win rates are broken out separately, and the best-performing hour of the day is called out.",
      "An equity curve chart renders directly in the session once there are at least two closed trades. Export every trade in the session to CSV from the toolbar at the top.",
    ],
  },
  {
    slug: "backtesting-journaling",
    title: "Backtesting: Journaling Backtest Trades",
    section: "Backtesting",
    summary: "Tag, note, and replay backtest trades exactly like live ones.",
    body: [
      "A backtest trade is a normal Trade row under the hood — it fully supports tags and a quick note, the same as a live trade.",
      "From a session's trade table, click a trade's date to open its full detail page (chart, stats, tags, quick note, and a candle-by-candle replay of that specific trade) — the same page a live trade uses. Click \"+ tag\" (or \"edit\" once it has tags) to add or change tags and the quick note there.",
      "A trade can also be linked to a full rich-text Notebook entry from the Notebook side (search by symbol, same as for a live trade) — once linked, the trade's detail page links back to it.",
    ],
  },
  {
    slug: "backtesting-ai",
    title: "Backtesting: AI Auto-Backtesting",
    section: "Backtesting",
    summary: "Describe a simple rule in plain English; it runs deterministically across the whole session.",
    body: [
      "Instead of manually stepping through candles, describe a strategy in plain English (for example: \"buy when price closes above the 20 EMA, exit at 1% profit or -0.5% loss, risk 1% per trade\") and the AI translates it into a structured rule.",
      "Before anything runs, the parsed rule is shown back in plain English for you to review — nothing executes until you confirm.",
      "Once confirmed, a deterministic engine (no AI involved in this step) evaluates that exact rule candle-by-candle across the session's entire date range and creates real, closed trades for every signal — identical in shape to a manually-placed trade.",
      "What this supports: one entry condition — price or a single indicator (EMA, SMA, or RSI) crossing or compared against price, another indicator, or a fixed value — plus a percentage-based take-profit and/or stop-loss, and either a fixed quantity or risk-% position sizing (which requires a stop-loss to size against).",
      "What this does NOT support: multiple entry conditions combined together, indicator-based exits, chart-pattern or price-action concepts (support/resistance, ICT terminology, candlestick patterns), or anything requiring judgment beyond a single threshold or cross. Describing a strategy that needs any of that gets approximated to the closest single-condition rule, which may not be what you meant — review the plain-English summary carefully before running it.",
      "At most one position is open at a time, so the engine can't pyramid into an existing position or run multiple signals concurrently.",
    ],
  },
];

export const HELP_SECTIONS = Array.from(new Set(HELP_ARTICLES.map((a) => a.section)));

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}
