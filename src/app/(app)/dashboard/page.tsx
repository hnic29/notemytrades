import {
  computeDailyPnl,
  computeDayStreak,
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
import type { RecentTrade } from "@/components/dashboard/RecentTradesWidget";
import { todayLocalKey } from "@/lib/date-key";

export default async function DashboardPage() {
  const todayKey = todayLocalKey();
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
  const dailyPnlMap = computeDailyPnl(trades);
  const dailyPnl = Object.fromEntries(dailyPnlMap);
  const dayStreak = computeDayStreak(dailyPnlMap);

  const recentTrades: RecentTrade[] = trades
    .filter((t) => t.closedAt != null)
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      symbol: t.symbol,
      openedAt: t.openedAt,
      netPnl: t.netPnl,
      status: t.netPnl >= 0 ? "win" : "loss",
    }));

  const openPositions: RecentTrade[] = trades
    .filter((t) => t.closedAt == null)
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .map((t) => ({
      id: t.id,
      symbol: t.symbol,
      openedAt: t.openedAt,
      netPnl: t.netPnl,
      status: "open",
    }));

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
        dayStreak={dayStreak}
        equityCurve={equityCurve}
        drawdownSeries={drawdown.series}
        dailyPnl={dailyPnl}
        startingBalance={startingBalance}
        progress={progress}
        recentTrades={recentTrades}
        openPositions={openPositions}
      />
    </div>
  );
}
