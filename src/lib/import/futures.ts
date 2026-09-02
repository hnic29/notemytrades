/**
 * Dollar value of a one-point move for one contract, keyed by root
 * symbol. Used to turn a price difference into P&L for futures fills
 * that arrive without a point value column. Only contracts whose
 * specs I'm sure of are listed — an unknown root gets multiplier 1
 * and a warning rather than a guess.
 */
export const FUTURES_POINT_VALUES: Record<string, number> = {
  // Equity index
  ES: 50,
  MES: 5,
  NQ: 20,
  MNQ: 2,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  NKD: 5,
  EMD: 100,
  VX: 1000,
  VXM: 100,
  // Energy
  CL: 1000,
  MCL: 100,
  QM: 500,
  NG: 10000,
  QG: 2500,
  RB: 42000,
  HO: 42000,
  BZ: 1000,
  // Metals
  GC: 100,
  MGC: 10,
  SI: 5000,
  SIL: 1000,
  HG: 25000,
  MHG: 2500,
  PL: 50,
  PA: 100,
  // Rates
  ZB: 1000,
  UB: 1000,
  ZN: 1000,
  TN: 1000,
  ZF: 1000,
  ZT: 2000,
  // FX
  "6E": 125000,
  M6E: 12500,
  "6J": 12500000,
  "6B": 62500,
  M6B: 6250,
  "6A": 100000,
  M6A: 10000,
  "6C": 100000,
  "6S": 125000,
  "6N": 100000,
  "6M": 500000,
  // Ags
  ZC: 50,
  ZS: 50,
  ZW: 50,
  KE: 50,
  ZO: 50,
  ZM: 100,
  ZL: 600,
  LE: 400,
  HE: 400,
  GF: 500,
  // Crypto
  BTC: 5,
  MBT: 0.1,
  ETH: 50,
  MET: 0.1,
};

export function getFuturesPointValue(root: string): number | null {
  return FUTURES_POINT_VALUES[root.toUpperCase()] ?? null;
}

const FUTURES_EXCHANGES = new Set([
  "CME",
  "CME_MINI",
  "CBOT",
  "CBOT_MINI",
  "NYMEX",
  "COMEX",
  "CBOE",
  "CFE",
  "EUREX",
  "ICEUS",
  "ICEEUR",
  "NYBOT",
  "SGX",
  "OSE",
  "MOEX",
]);
const CRYPTO_EXCHANGES = new Set([
  "BINANCE",
  "COINBASE",
  "BYBIT",
  "KRAKEN",
  "BITSTAMP",
  "BITFINEX",
  "OKX",
  "KUCOIN",
  "GEMINI",
  "BITGET",
  "CRYPTO",
]);
const FOREX_EXCHANGES = new Set(["FX", "FX_IDC", "OANDA", "FXCM", "FOREXCOM", "SAXO", "PEPPERSTONE", "ICMARKETS", "EIGHTCAP"]);

/**
 * Futures tickers on TradingView are either continuous ("MNQ1!", "ES2!")
 * or a specific contract ("MNQZ2026", "ESH26"). Captures the root either
 * way; returns null for anything that doesn't look like futures.
 */
const CONTINUOUS_TICKER = /^([A-Z0-9]+?)\d!$/;
const CONTRACT_TICKER = /^([A-Z0-9]+?)[FGHJKMNQUVXZ](?:\d{2}|\d{4})$/;

export type ParsedSymbol = {
  /** Symbol to store on the trade — exchange prefix stripped, continuous
   *  contracts collapsed to their root so every front-month roll of MNQ
   *  groups together in reports. */
  symbol: string;
  root: string;
  exchange: string | null;
  assetType: "futures" | "stock" | "forex" | "crypto" | null;
};

export function parseTradingViewSymbol(raw: string): ParsedSymbol {
  const trimmed = raw.trim().toUpperCase();
  const colon = trimmed.indexOf(":");
  const exchange = colon === -1 ? null : trimmed.slice(0, colon);
  const ticker = colon === -1 ? trimmed : trimmed.slice(colon + 1);

  const onFuturesExchange = exchange != null && FUTURES_EXCHANGES.has(exchange);
  const continuous = CONTINUOUS_TICKER.exec(ticker);
  if (continuous) {
    return { symbol: continuous[1], root: continuous[1], exchange, assetType: "futures" };
  }
  // The month-code form ("ESH26") is only trusted on a futures exchange
  // or with no exchange at all — a plain stock ticker could match it.
  const contract = CONTRACT_TICKER.exec(ticker);
  if (contract && (onFuturesExchange || exchange == null)) {
    return { symbol: ticker, root: contract[1], exchange, assetType: "futures" };
  }
  if (onFuturesExchange) {
    return { symbol: ticker, root: ticker, exchange, assetType: "futures" };
  }
  if (exchange && CRYPTO_EXCHANGES.has(exchange)) {
    return { symbol: ticker, root: ticker, exchange, assetType: "crypto" };
  }
  if (exchange && FOREX_EXCHANGES.has(exchange)) {
    return { symbol: ticker, root: ticker, exchange, assetType: "forex" };
  }
  return { symbol: ticker, root: ticker, exchange, assetType: exchange ? "stock" : null };
}
