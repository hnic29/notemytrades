export function formatCurrency(value: number, currency = "USD") {
  const sign = value < 0 ? "-" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${sign}${formatted}`;
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Dashboard-wide "how should a $ figure be shown right now" switch —
 * dollars/percent/privacy are all just different formatting of the
 * same underlying dollar number; rMultiple expects `value` to already
 * be in R units (a trade's own planned risk isn't a single constant
 * you can divide an arbitrary dollar figure by). */
export type DashboardViewMode = "dollars" | "percent" | "rMultiple" | "privacy";

export function formatDashboardValue(
  value: number,
  mode: DashboardViewMode,
  startingBalance: number,
): string {
  if (mode === "privacy") return "•••";
  if (mode === "rMultiple") return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
  if (mode === "percent" && startingBalance > 0) return formatPercent(value / startingBalance);
  return formatCurrency(value);
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function toDatetimeLocalValue(date: Date | string | null) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
