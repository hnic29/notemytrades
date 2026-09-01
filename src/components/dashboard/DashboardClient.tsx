"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "./StatCard";
import { EquityCurveChart } from "./EquityCurveChart";
import { DrawdownChart } from "./DrawdownChart";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { TradeScoreGauge } from "./TradeScoreGauge";
import { RingStat } from "./RingStat";
import { RecentTradesWidget, type RecentTrade } from "./RecentTradesWidget";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { EquityPoint, SummaryStats } from "@/lib/analytics/stats";
import Link from "next/link";

type WidgetKey =
  | "stats"
  | "tradeScore"
  | "recentTrades"
  | "equityCurve"
  | "drawdown"
  | "calendar"
  | "progressTracker";

const WIDGET_LABELS: Record<WidgetKey, string> = {
  stats: "Summary Stats",
  tradeScore: "Trade Score",
  recentTrades: "Recent Trades",
  equityCurve: "Equity Curve",
  drawdown: "Drawdown",
  calendar: "Calendar",
  progressTracker: "Progress Tracker",
};

const DEFAULT_ORDER: WidgetKey[] = [
  "stats",
  "tradeScore",
  "recentTrades",
  "equityCurve",
  "drawdown",
  "calendar",
  "progressTracker",
];
const STORAGE_KEY = "nmt.dashboard.widgets.v3";

function loadPrefs(): { order: WidgetKey[]; hidden: WidgetKey[] } {
  if (typeof window === "undefined") return { order: DEFAULT_ORDER, hidden: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("none");
    const parsed = JSON.parse(raw);
    return { order: parsed.order ?? DEFAULT_ORDER, hidden: parsed.hidden ?? [] };
  } catch {
    return { order: DEFAULT_ORDER, hidden: [] };
  }
}

export function DashboardClient({
  stats,
  tradeScore,
  dayStreak,
  equityCurve,
  drawdownSeries,
  dailyPnl,
  startingBalance,
  progress,
  recentTrades,
  openPositions,
}: {
  stats: SummaryStats;
  tradeScore: number | null;
  dayStreak: number;
  equityCurve: EquityPoint[];
  drawdownSeries: { date: string; drawdown: number }[];
  dailyPnl: Record<string, number>;
  startingBalance: number;
  progress: { streak: number; ruleCount: number; passedToday: number } | null;
  recentTrades: RecentTrade[];
  openPositions: RecentTrade[];
}) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showMenu, setShowMenu] = useState(false);
  const [percentView, setPercentView] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Standard hydration-safe mount flag — localStorage-derived prefs must
  // render as the SSR default on first paint, then switch client-side.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const persist = (next: typeof prefs) => {
    setPrefs(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleHidden = (key: WidgetKey) => {
    const hidden = prefs.hidden.includes(key)
      ? prefs.hidden.filter((k) => k !== key)
      : [...prefs.hidden, key];
    persist({ ...prefs, hidden });
  };

  const move = (key: WidgetKey, dir: -1 | 1) => {
    const order = [...prefs.order];
    const idx = order.indexOf(key);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= order.length) return;
    [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
    persist({ ...prefs, order });
  };

  const money = (value: number) =>
    percentView && startingBalance > 0
      ? formatPercent(value / startingBalance)
      : formatCurrency(value);

  const visibleOrder = mounted ? prefs.order : DEFAULT_ORDER;
  const hiddenSet = mounted ? new Set(prefs.hidden) : new Set<WidgetKey>();

  const widgetContent: Record<WidgetKey, React.ReactNode> = {
    stats: (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Net P&L"
          value={money(stats.netPnl)}
          tone={stats.netPnl >= 0 ? "profit" : "loss"}
        />
        <div className="rounded-lg border border-border bg-surface p-4">
          <RingStat
            label="Win Rate"
            value={stats.winRate}
            displayValue={stats.winRate != null ? formatPercent(stats.winRate, 0) : "—"}
            tone="profit"
          />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <RingStat
            label="Profit Factor"
            value={stats.profitFactor != null ? Math.min(stats.profitFactor / 3, 1) : null}
            displayValue={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
            tone="accent"
          />
        </div>
        <StatCard label="Avg Win" value={money(stats.avgWin)} tone="profit" />
        <StatCard label="Avg Loss" value={money(-stats.avgLoss)} tone="loss" />
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs text-text-faint">Current Streak</div>
          <div className="mt-2 flex items-center gap-4">
            <div>
              <div
                className={cn(
                  "text-xl font-semibold",
                  dayStreak > 0 ? "text-profit" : dayStreak < 0 ? "text-loss" : "text-text",
                )}
              >
                {dayStreak === 0 ? "—" : Math.abs(dayStreak)}
              </div>
              <div className="text-[10px] text-text-faint">
                {dayStreak > 0 ? "days" : dayStreak < 0 ? "days" : "days"}
              </div>
            </div>
            <div>
              <div
                className={cn(
                  "text-xl font-semibold",
                  stats.currentStreak > 0
                    ? "text-profit"
                    : stats.currentStreak < 0
                      ? "text-loss"
                      : "text-text",
                )}
              >
                {stats.currentStreak === 0 ? "—" : Math.abs(stats.currentStreak)}
              </div>
              <div className="text-[10px] text-text-faint">trades</div>
            </div>
          </div>
        </div>
      </div>
    ),
    tradeScore: (
      <div className="flex justify-center">
        <TradeScoreGauge score={tradeScore} />
      </div>
    ),
    recentTrades: <RecentTradesWidget recent={recentTrades} open={openPositions} />,
    equityCurve: <EquityCurveChart data={equityCurve} />,
    drawdown: <DrawdownChart data={drawdownSeries} />,
    calendar: <CalendarHeatmap dailyPnl={dailyPnl} />,
    progressTracker: progress ? (
      progress.ruleCount === 0 ? (
        <p className="text-sm text-text-faint">
          No active daily rules yet.{" "}
          <Link href="/progress" className="text-accent hover:underline">
            Set one up
          </Link>
          .
        </p>
      ) : (
        <div className="flex items-center gap-6">
          <div>
            <div className="text-2xl font-semibold text-accent">{progress.streak}</div>
            <div className="text-xs text-text-faint">day streak</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-text">
              {progress.passedToday}/{progress.ruleCount}
            </div>
            <div className="text-xs text-text-faint">followed today</div>
          </div>
          <Link href="/progress" className="ml-auto text-xs text-accent hover:underline">
            Check in →
          </Link>
        </div>
      )
    ) : null,
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          onClick={() => setPercentView((v) => !v)}
          disabled={startingBalance <= 0}
          title={
            startingBalance <= 0
              ? "Set a starting balance on an account to enable percent view"
              : undefined
          }
          className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {percentView ? "Showing %" : "Showing $"}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-2"
          >
            <Settings2 className="h-3.5 w-3.5" /> Widgets
          </button>
          {showMenu && (
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-border bg-surface-2 p-2 shadow-lg">
              {prefs.order.map((key, i) => (
                <div key={key} className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-text hover:bg-surface-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!prefs.hidden.includes(key)}
                      onChange={() => toggleHidden(key)}
                      className="accent-accent"
                    />
                    {WIDGET_LABELS[key]}
                  </label>
                  <div className="flex gap-1">
                    <button
                      disabled={i === 0}
                      onClick={() => move(key, -1)}
                      className="text-text-faint hover:text-text disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      disabled={i === prefs.order.length - 1}
                      onClick={() => move(key, 1)}
                      className="text-text-faint hover:text-text disabled:opacity-20"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visibleOrder
          .filter((key) => !hiddenSet.has(key))
          .map((key) => (
            <div
              key={key}
              className={cn(
                "rounded-lg border border-border bg-surface p-4",
                (key === "equityCurve" || key === "drawdown" || key === "stats") &&
                  "lg:col-span-2",
              )}
            >
              <h2 className="mb-3 text-sm font-medium text-text-muted">{WIDGET_LABELS[key]}</h2>
              {widgetContent[key]}
            </div>
          ))}
      </div>
    </div>
  );
}
