import type { TradeSide } from "@/lib/trade-math";

export type ParsedTradeRow = {
  symbol: string;
  side: TradeSide;
  quantity: number;
  /** Point/contract value applied to P&L; omitted means 1. */
  multiplier?: number;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  openedAt: string; // ISO
  closedAt: string | null;
  fees: number;
  commissions: number;
  netPnl: number;
  netRoi: number | null;
};

export type ParseResult = {
  trades: ParsedTradeRow[];
  /** Row-level failures: the row was skipped, the rest of the file still imports. */
  errors: { row: number; message: string }[];
  /** File-level caveats that didn't block the import but the user should read. */
  warnings?: string[];
  /** Asset type the parser is confident about (e.g. futures from a CME symbol). */
  suggestedAssetType?: string;
  /** What each dropped file turned out to be, so the user never has to sort them. */
  files?: FileRole[];
};

export type FileRole = {
  name: string;
  /** Human label, e.g. "Order history". */
  role: string;
  /** Whether the importer read anything from it. */
  used: boolean;
  /** Short note, e.g. "250 orders" or "not needed". */
  note?: string;
};

/** One parsed CSV as handed to an aggregate importer. */
export type ImportFile = {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
};

export function parseNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const isParen = /^\(.*\)$/.test(cleaned);
  const n = Number(isParen ? cleaned.slice(1, -1) : cleaned);
  if (!Number.isFinite(n)) return null;
  return isParen ? -n : n;
}

export function parseDate(raw: string | undefined): string | null {
  if (!raw || raw.trim() === "") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const hasHeader = (headers: string[], name: string) =>
  headers.some((h) => h.trim().toLowerCase() === name.toLowerCase());
