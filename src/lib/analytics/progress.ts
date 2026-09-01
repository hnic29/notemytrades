export type DayResult = { date: string; passed: boolean };

/**
 * Counts the current streak of fully-passed days, walking backward from
 * the most recent entry. `days` need not be pre-sorted. A gap in dates
 * (a day with no entry at all) is NOT treated as a break by itself —
 * only an explicit `passed: false` breaks the streak — since a rule
 * created partway through a month shouldn't be punished for days
 * before it existed. Callers should only pass in days that were
 * actually evaluated.
 */
export function computeAdherenceStreak(days: DayResult[]): number {
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const day of sorted) {
    if (!day.passed) break;
    streak++;
  }
  return streak;
}

/** A day counts as "fully passed" only if every active rule for that
 * day was both evaluated and passed — a rule with no entry yet doesn't
 * silently count as a pass. */
export function isDayComplete(passedCount: number, evaluatedCount: number, totalActiveRules: number): boolean {
  if (totalActiveRules === 0) return false;
  return evaluatedCount === totalActiveRules && passedCount === totalActiveRules;
}
