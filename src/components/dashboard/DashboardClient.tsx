"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "./StatCard";
import { EquityCurveChart } from "./EquityCurveChart";
import { DrawdownChart } from "./DrawdownChart";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { TradeScoreGauge } from "./TradeScoreGauge";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { EquityPoint, SummaryStats } from "@/lib/analytics/stats";

type WidgetKey =
  | "stats"
  | "tradeScore"
  | "equityCurve"
  | "drawdown"
  | "calendar";

const WIDGET_LABELS: Record<WidgetKey, string> = {
  stats: "Summary Stats",
  tradeScore: "Trade Score",
  equityCurve: "Equity Curve",
  drawdown: "Drawdown",
  calendar: "Calendar",
};

const DEFAULT_ORDER: WidgetKey[] = ["stats", "tradeScore", "equityCurve", "drawdown", "calendar"];
const STORAGE_KEY = "nmt.dashboard.widgets.v1";

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
  equityCurve,
  drawdownSeries,
  dailyPnl,
  startingBalance,
}: {
  stats: SummaryStats;
  tradeScore: number | null;
  equityCurve: EquityPoint[];
  drawdownSeries: { date: string; drawdown: number }[];
  dailyPnl: Record<string, number>;
  startingBalance: number;
}) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showMenu, setShowMenu] = useState(false);
  const [percentView, setPercentView] = useState(false);
  const [mounted, setMounted] = useState(false);

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
        <StatCard
          label="Win Rate"
          value={stats.winRate != null ? formatPercent(stats.winRate) : "—"}
          sub={`${stats.wins}W / ${stats.losses}L`}
        />
        <StatCard
          label="Profit Factor"
          value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
        />
        <StatCard label="Avg Win" value={money(stats.avgWin)} tone="profit" />
        <StatCard label="Avg Loss" value={money(-stats.avgLoss)} tone="loss" />
        <StatCard
          label="Current Streak"
          value={stats.currentStreak === 0 ? "—" : String(Math.abs(stats.currentStreak))}
          tone={stats.currentStreak > 0 ? "profit" : stats.currentStreak < 0 ? "loss" : "neutral"}
          sub={stats.currentStreak > 0 ? "wins" : stats.currentStreak < 0 ? "losses" : undefined}
        />
      </div>
    ),
    tradeScore: (
      <div className="flex justify-center">
        <TradeScoreGauge score={tradeScore} />
      </div>
    ),
    equityCurve: <EquityCurveChart data={equityCurve} />,
    drawdown: <DrawdownChart data={drawdownSeries} />,
    calendar: <CalendarHeatmap dailyPnl={dailyPnl} />,
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
