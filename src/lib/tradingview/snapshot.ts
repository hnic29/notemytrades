/**
 * What the sync reads out of a running TradingView Desktop, and the
 * script that reads it.
 *
 * TradingView has no public Paper Trading API. What it does have is
 * Chromium's remote-debugging protocol (TradingView Desktop is an
 * Electron app — launch it with `--remote-debugging-port=9222`) and,
 * inside the chart page, `window.TradingViewApi.trading()`, the same
 * object its own Trading Panel is built on. Every method used here is
 * read-only; nothing in this file can place, modify or cancel an order.
 *
 * Shapes below were captured from TradingView Desktop 3.4 (Chrome 146)
 * and are kept minimal so a field TradingView renames later breaks one
 * mapping, not the whole sync.
 */

export type SnapshotExecution = {
  id: string;
  /** TradingView's own symbol, e.g. "CME_MINI:MNQ1!". */
  symbol: string;
  price: number;
  qty: number;
  /** 1 = buy, -1 = sell. */
  side: 1 | -1;
  /** Fill time, ms since epoch. */
  time: number;
  commission: number | null;
  orderId: string | null;
};

export type SnapshotPosition = {
  symbol: string;
  /** 1 = long, -1 = short. */
  side: 1 | -1;
  qty: number;
  avgPrice: number;
  pointValue: number | null;
};

/** One line of TradingView's account (balance) history. */
export type SnapshotHistoryEntry = {
  /** Balance before / after the event — their difference is the realized P&L. */
  before: number;
  after: number;
  /** "Close long position for symbol … point value: 2.000000" */
  comment: string;
  /** Seconds since epoch (TradingView's choice, not ms). */
  time: number;
  orderId: string | null;
};

export type TradingViewSnapshot = {
  broker: { id: string; title: string };
  account: { id: string; name: string; type: string } | null;
  executions: SnapshotExecution[];
  positions: SnapshotPosition[];
  /** Null when TradingView's internals didn't expose it — sync still works, unverified. */
  history: SnapshotHistoryEntry[] | null;
  /** Point value per TradingView symbol, from symbol info where available. */
  pointValues: Record<string, number>;
  /** When the snapshot was taken, ms since epoch. */
  takenAt: number;
};

export type SnapshotFailure = {
  ok: false;
  code: "no-api" | "no-broker" | "not-connected" | "unsupported-broker";
  broker?: { id: string; title: string };
};

export type SnapshotResult = ({ ok: true } & TradingViewSnapshot) | SnapshotFailure;

/**
 * Evaluated inside the chart page. Plain ES2020 in a string on purpose:
 * the bundler never sees it, so nothing gets renamed or polyfilled on
 * the way to TradingView's renderer. Resolves to a SnapshotResult.
 */
export const SNAPSHOT_SCRIPT = String.raw`
(async () => {
  const api = window.TradingViewApi;
  if (!api || typeof api.trading !== "function") return { ok: false, code: "no-api" };
  const trading = api.trading();
  let broker = typeof trading.activeBroker === "function" ? trading.activeBroker() : null;
  // Depending on the build this is the broker itself or a watched value wrapping it.
  if (broker && typeof broker.metainfo !== "function" && typeof broker.value === "function") broker = broker.value();
  if (!broker || typeof broker.metainfo !== "function") return { ok: false, code: "no-broker" };
  const meta = broker.metainfo() || {};
  const brokerInfo = { id: String(meta.id ?? ""), title: String(meta.title ?? meta.id ?? "") };
  const status = typeof broker.connectStatus === "function" ? broker.connectStatus() : 1;
  if (status !== 1) return { ok: false, code: "not-connected", broker: brokerInfo };
  if (brokerInfo.id !== "Paper") return { ok: false, code: "unsupported-broker", broker: brokerInfo };

  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v) => (v == null ? null : String(v));

  const accountId = str(await broker.currentAccount());
  let account = null;
  try {
    const accounts = await broker.accountsMetainfo();
    const a = (accounts || []).find((x) => str(x.id) === accountId);
    if (a) account = { id: str(a.id), name: str(a.name) ?? "", type: str(a.type) ?? "" };
    else if (accountId) account = { id: accountId, name: "", type: "" };
  } catch (e) {
    if (accountId) account = { id: accountId, name: "", type: "" };
  }

  // transactions() pages through the REST history until it runs dry,
  // unlike allExecutions() which is the last 1000 the panel loaded.
  let raw = [];
  try {
    const tx = await broker.transactions();
    raw = (tx && tx.tradeTransactions) || [];
  } catch (e) {
    raw = [];
  }
  if (raw.length === 0 && typeof broker.allExecutions === "function") {
    try { raw = (await broker.allExecutions()) || []; } catch (e) { raw = []; }
  }
  const executions = raw
    .map((t) => ({
      id: str(t.id) ?? "",
      symbol: str(t.symbol) ?? "",
      price: num(t.price),
      qty: num(t.qty),
      side: t.side === -1 ? -1 : 1,
      time: num(t.time),
      commission: num(t.commission),
      orderId: str(t.orderId),
    }))
    .filter((t) => t.symbol && t.price != null && t.qty != null && t.time != null);

  const positions = ((await broker.positions()) || [])
    .map((p) => ({
      symbol: str(p.symbol) ?? "",
      side: p.side === -1 ? -1 : 1,
      qty: num(p.qty),
      avgPrice: num(p.avgPrice),
      pointValue: p.extra ? num(p.extra.pointValue) : null,
    }))
    .filter((p) => p.symbol && p.qty != null && p.avgPrice != null);

  // The balance history isn't on the public broker surface; it hangs
  // off the REST transport the panel uses for its own History tab.
  let history = null;
  try {
    const rest = broker._brokerConnection._brokerConnection.currentAccountApi().transactionsCapability._restTransport;
    const rows = await rest.accountHistory({ recordsCount: 5000 });
    if (Array.isArray(rows)) {
      history = rows
        .map((h) => ({
          before: num(h.before),
          after: num(h.after),
          comment: str(h.comment) ?? "",
          time: num(h.time),
          orderId: str(h.order),
        }))
        .filter((h) => h.before != null && h.after != null && h.time != null);
    }
  } catch (e) {
    history = null;
  }

  const pointValues = {};
  for (const p of positions) if (p.pointValue != null) pointValues[p.symbol] = p.pointValue;
  const symbols = new Set(executions.map((t) => t.symbol));
  for (const symbol of symbols) {
    if (pointValues[symbol] != null) continue;
    try {
      const info = await broker.symbolInfo(symbol);
      const pipValue = num(info && info.pipValue);
      const pipSize = num(info && info.pipSize);
      if (pipValue != null && pipSize) pointValues[symbol] = pipValue / pipSize;
    } catch (e) {
      // no info → the futures table / balance history decide
    }
  }

  return { ok: true, broker: brokerInfo, account, executions, positions, history, pointValues, takenAt: Date.now() };
})()
`;
