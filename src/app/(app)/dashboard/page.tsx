import {
  computeDailyPnl,
  computeDrawdown,
  computeEquityCurve,
  computeSummaryStats,
  computeTradeScore,
} from "@/lib/analytics/stats";
import { getDashboardTrades, getTotalStartingBalance } from "@/lib/queries/dashboard";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const [trades, startingBalance] = await Promise.all([
    getDashboardTrades(),
    getTotalStartingBalance(),
  ]);

  const stats = computeSummaryStats(trades);
  const tradeScore = computeTradeScore(stats);
  const equityCurve = computeEquityCurve(trades, startingBalance);
  const drawdown = computeDrawdown(equityCurve);
  const dailyPnl = Object.fromEntries(computeDailyPnl(trades));

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
      />
    </div>
  );
}
