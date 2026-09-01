import {
  getRecentTradesForChecklist,
  getStatesForDate,
  getTradeRuleStates,
  listActiveDailyRules,
  listActivePerTradeRules,
  listRecentDailyResults,
  listRules,
} from "@/lib/queries/progress";
import { computeAdherenceStreak, isDayComplete } from "@/lib/analytics/progress";
import { RuleManager } from "@/components/progress/RuleManager";
import { DailyCheckin } from "@/components/progress/DailyCheckin";
import { TradeChecklist } from "@/components/progress/TradeChecklist";

export default async function ProgressPage() {
  const todayKey = new Date().toISOString().slice(0, 10);

  const [rules, dailyRules, perTradeRules, todayStates, recentResults, recentTrades] =
    await Promise.all([
      listRules(),
      listActiveDailyRules(),
      listActivePerTradeRules(),
      getStatesForDate(todayKey),
      listRecentDailyResults(),
      getRecentTradesForChecklist(),
    ]);

  const tradeStates = await getTradeRuleStates(recentTrades.map((t) => t.id));

  const todayStateMap = Object.fromEntries(
    todayStates.filter((s) => s.tradeId == null).map((s) => [s.ruleId, s.passed]),
  );

  const dayResults = recentResults.map((r) => ({
    date: r.date,
    passed: isDayComplete(r.passed, r.evaluated, r.totalActiveRules),
  }));
  const streak = computeAdherenceStreak(dayResults);

  const tradeStateMap: Record<string, Record<string, boolean>> = {};
  for (const s of tradeStates) {
    if (!s.tradeId) continue;
    tradeStateMap[s.tradeId] ??= {};
    tradeStateMap[s.tradeId][s.ruleId] = s.passed;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-text">Progress Tracker</h1>

      {dailyRules.length > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="text-3xl font-semibold text-accent">{streak}</div>
          <div className="text-sm text-text-muted">
            day{streak === 1 ? "" : "s"} in a row with every daily rule followed
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Today&apos;s Check-in</h2>
        <DailyCheckin dateKey={todayKey} rules={dailyRules} states={todayStateMap} />
      </div>

      {perTradeRules.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-text-muted">Recent Trades Checklist</h2>
          <TradeChecklist rules={perTradeRules} trades={recentTrades} states={tradeStateMap} />
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-text-muted">Rules</h2>
        <RuleManager rules={rules} />
      </div>
    </div>
  );
}
