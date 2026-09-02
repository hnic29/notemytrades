/**
 * A calendar-day key (YYYY-MM-DD) for a Date, using the runtime's own
 * local timezone rather than UTC. For a self-hosted, single-machine
 * app the server and the user are on the same clock, so "local" here
 * is "the day the user actually experienced it" — not an arbitrary
 * UTC cutoff that can land a late-evening trade on "tomorrow."
 *
 * Every place that groups trades (or anything else) by day — the
 * calendar heatmap, the Daily Journal, Progress Tracker, prop-account
 * daily-loss checks — must go through this one function, or two
 * features can silently disagree about which day a given trade
 * belongs to.
 */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The [start, end] local-day boundaries for a YYYY-MM-DD key, as real
 * Date instants — for filtering "what happened on this day" by local
 * calendar day instead of UTC's. */
export function localDayRange(dateKey: string): { start: Date; end: Date } {
  const [y, m, day] = dateKey.split("-").map(Number);
  const start = new Date(y, m - 1, day, 0, 0, 0, 0);
  const end = new Date(y, m - 1, day, 23, 59, 59, 999);
  return { start, end };
}

/** Today's local-day key — the shared "what day is it" every page
 * that needs "today" (Dashboard, Progress Tracker, Prop Accounts)
 * should use, instead of each computing its own UTC version. */
export function todayLocalKey(): string {
  return localDateKey(new Date());
}
