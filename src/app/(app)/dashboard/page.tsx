import {
  computeDailyPnl,
  computeDrawdown,
  computeEquityCurve,
  computeSummaryStats,
  computeTradeScore,
} from "@/lib/analytics/stats";
import { getDashboardTrades, getTotalStartingBalance } from "@/lib/queries/dashboard";
import {
  getStatesForDate,
  listActiveDailyRules,
  listRecentDailyResults,
} from "@/lib/queries/progress";
import { computeAdherenceStreak, isDayComplete } from "@/lib/analytics/progress";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [trades, startingBalance, dailyRules, todayStates, recentResults] = await Promise.all([
    getDashboardTrades(),
    getTotalStartingBalance(),
    listActiveDailyRules(),
    getStatesForDate(todayKey),
    listRecentDailyResults(),
  ]);

  const stats = computeSummaryStats(trades);
  const tradeScore = computeTradeScore(stats);
  const equityCurve = computeEquityCurve(trades, startingBalance);
  const drawdown = computeDrawdown(equityCurve);
  const dailyPnl = Object.fromEntries(computeDailyPnl(trades));

  const dayResults = recentResults.map((r) => ({
    date: r.date,
    passed: isDayComplete(r.passed, r.evaluated, r.totalActiveRules),
  }));
  const progress = {
    streak: computeAdherenceStreak(dayResults),
    ruleCount: dailyRules.length,
    passedToday: todayStates.filter((s) => s.tradeId == null && s.passed).length,
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text">Dashboard</h1>
      <DashboardClient
        stats={stats}
        tradeScore={tradeScore}
        equityCurve={equityCurve}
        drawdownSeries={drawdown.series}
        dailyPnl={dailyPnl}
        startingBalance={startingBalance}
        progress={progress}
      />
    </div>
  );
}
