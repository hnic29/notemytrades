export type ReportFilters = {
  from?: string; // yyyy-mm-dd, inclusive
  to?: string; // yyyy-mm-dd, inclusive
  accountId?: string;
  symbol?: string;
  side?: "long" | "short";
  tag?: string;
};

const KEYS: (keyof ReportFilters)[] = ["from", "to", "accountId", "symbol", "side", "tag"];

/** Reads filters out of Next's resolved searchParams (string | string[] | undefined
 * per key) — first value wins if a param is repeated. */
export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ReportFilters {
  const out: ReportFilters = {};
  for (const key of KEYS) {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) (out as Record<string, string>)[key] = value;
  }
  return out;
}

export function filtersToSearchParams(filters: ReportFilters): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(filters: ReportFilters): boolean {
  return KEYS.some((k) => Boolean(filters[k]));
}
