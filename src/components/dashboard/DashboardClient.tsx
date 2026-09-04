"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Settings2, GripVertical, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "./StatCard";
import { EquityCurveChart } from "./EquityCurveChart";
import { DrawdownChart } from "./DrawdownChart";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { TradeScoreGauge } from "./TradeScoreGauge";
import { RingStat } from "./RingStat";
import { RecentTradesWidget, type RecentTrade } from "./RecentTradesWidget";
import { formatDashboardValue, formatPercent, type DashboardViewMode } from "@/lib/format";
import type { EquityPoint, SummaryStats, TradeScore } from "@/lib/analytics/stats";
import Link from "next/link";

const VIEW_MODE_LABELS: Record<DashboardViewMode, string> = {
  dollars: "Dollars",
  percent: "Percentage",
  rMultiple: "R-Multiple",
  privacy: "Privacy",
};

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
  rStats,
  rEquityCurve,
  rDrawdownSeries,
  rDailyPnl,
  startingBalance,
  progress,
  recentTrades,
  openPositions,
  journaledDates,
}: {
  stats: SummaryStats;
  tradeScore: TradeScore | null;
  dayStreak: number;
  equityCurve: EquityPoint[];
  drawdownSeries: { date: string; drawdown: number }[];
  dailyPnl: Record<string, number>;
  /** Same shapes as their dollar counterparts, but every trade's netPnl
   * has been replaced by its R-multiple — swapped in wholesale for the
   * "R-Multiple" view mode rather than converting dollar figures
   * post-hoc, since a trade's R depends on its own planned risk. */
  rStats: SummaryStats;
  rEquityCurve: EquityPoint[];
  rDrawdownSeries: { date: string; drawdown: number }[];
  rDailyPnl: Record<string, number>;
  startingBalance: number;
  progress: { streak: number; ruleCount: number; passedToday: number } | null;
  recentTrades: RecentTrade[];
  openPositions: RecentTrade[];
  journaledDates: string[];
}) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [showMenu, setShowMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [viewMode, setViewMode] = useState<DashboardViewMode>("dollars");
  const [mounted, setMounted] = useState(false);
  const [draggedKey, setDraggedKey] = useState<WidgetKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<WidgetKey | null>(null);
  const [snappedKey, setSnappedKey] = useState<WidgetKey | null>(null);
  const cardRefs = useRef<Map<WidgetKey, HTMLDivElement>>(new Map());
  // Positions captured right before a drop reorders `prefs.order` — the
  // layout effect below reads this once to FLIP-animate every widget
  // from its old spot to its new one instead of letting the grid just
  // jump. Only set inside `reorder`, so hide/show toggles (which also
  // call `persist`) don't trigger it.
  const flipFromRef = useRef<Map<WidgetKey, DOMRect> | null>(null);

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

  const reorder = (dragged: WidgetKey, target: WidgetKey) => {
    if (dragged === target) return;
    const order = [...prefs.order];
    const from = order.indexOf(dragged);
    const to = order.indexOf(target);
    if (from === -1 || to === -1) return;

    const rects = new Map<WidgetKey, DOMRect>();
    cardRefs.current.forEach((el, key) => rects.set(key, el.getBoundingClientRect()));
    flipFromRef.current = rects;

    order.splice(from, 1);
    order.splice(to, 0, dragged);
    persist({ ...prefs, order });
    setSnappedKey(dragged);
  };

  // FLIP: after the grid re-renders in the new order, every widget is
  // already at its final position — this nudges each one back to where
  // it visually was (via an instant transform) and then animates that
  // transform away, so widgets glide into place instead of jumping.
  useLayoutEffect(() => {
    const prevRects = flipFromRef.current;
    if (!prevRects) return;
    flipFromRef.current = null;

    cardRefs.current.forEach((el, key) => {
      const prev = prevRects.get(key);
      if (!prev) return;
      const next = el.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (dx === 0 && dy === 0) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.getBoundingClientRect(); // force reflow before animating away from the transform above
      requestAnimationFrame(() => {
        el.style.transition = "transform 220ms cubic-bezier(0.2, 0, 0, 1)";
        el.style.transform = "";
      });
    });
  }, [prefs.order]);

  const handleDragStart = (key: WidgetKey) => (e: React.DragEvent<HTMLElement>) => {
    setDraggedKey(key);
    e.dataTransfer.effectAllowed = "move";
    // Drag the whole card as the ghost image, not just the small handle
    // the drag actually started from.
    const card = e.currentTarget.closest<HTMLElement>("[data-widget-card]");
    if (card) e.dataTransfer.setDragImage(card, 24, 24);
  };

  const handleDragEnd = () => {
    setDraggedKey(null);
    setDragOverKey(null);
  };

  const handleDragOver = (key: WidgetKey) => (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggedKey || draggedKey === key) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverKey(key);
  };

  const handleDrop = (key: WidgetKey) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedKey) reorder(draggedKey, key);
    setDraggedKey(null);
    setDragOverKey(null);
  };

  const money = (value: number) => formatDashboardValue(value, viewMode, startingBalance);

  // R-Multiple swaps in the whole R-substituted dataset (a trade's R
  // depends on its own planned risk, not a single global divisor);
  // dollars/percent/privacy are all just different string formatting
  // of the same dollar-denominated data, handled by `money` above.
  const activeStats = viewMode === "rMultiple" ? rStats : stats;
  const activeEquityCurve = viewMode === "rMultiple" ? rEquityCurve : equityCurve;
  const activeDrawdownSeries = viewMode === "rMultiple" ? rDrawdownSeries : drawdownSeries;
  const activeDailyPnl = viewMode === "rMultiple" ? rDailyPnl : dailyPnl;

  const visibleOrder = mounted ? prefs.order : DEFAULT_ORDER;
  const hiddenSet = mounted ? new Set(prefs.hidden) : new Set<WidgetKey>();

  const widgetContent: Record<WidgetKey, React.ReactNode> = {
    stats: (
      <div>
        {viewMode === "rMultiple" && (
          <p className="mb-3 text-xs text-text-faint">
            Only trades with a stop loss set have a defined R — everything below reflects those{" "}
            {activeStats.closedTrades} trade{activeStats.closedTrades === 1 ? "" : "s"}.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Net P&L"
            value={money(activeStats.netPnl)}
            tone={activeStats.netPnl >= 0 ? "profit" : "loss"}
          />
          <div className="rounded-lg border border-border bg-surface p-4">
            <RingStat
              label="Win Rate"
              value={activeStats.winRate}
              displayValue={activeStats.winRate != null ? formatPercent(activeStats.winRate, 0) : "—"}
              tone="profit"
            />
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <RingStat
              label="Profit Factor"
              value={activeStats.profitFactor != null ? Math.min(activeStats.profitFactor / 3, 1) : null}
              displayValue={activeStats.profitFactor != null ? activeStats.profitFactor.toFixed(2) : "—"}
              tone="accent"
            />
          </div>
          <StatCard label="Avg Win" value={money(activeStats.avgWin)} tone="profit" />
          <StatCard label="Avg Loss" value={money(-activeStats.avgLoss)} tone="loss" />
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
                    activeStats.currentStreak > 0
                      ? "text-profit"
                      : activeStats.currentStreak < 0
                        ? "text-loss"
                        : "text-text",
                  )}
                >
                  {activeStats.currentStreak === 0 ? "—" : Math.abs(activeStats.currentStreak)}
                </div>
                <div className="text-[10px] text-text-faint">trades</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    tradeScore: <TradeScoreGauge score={tradeScore} />,
    recentTrades: (
      <RecentTradesWidget
        recent={recentTrades}
        open={openPositions}
        viewMode={viewMode}
        startingBalance={startingBalance}
      />
    ),
    equityCurve: (
      <EquityCurveChart data={activeEquityCurve} viewMode={viewMode} startingBalance={startingBalance} />
    ),
    drawdown: (
      <DrawdownChart data={activeDrawdownSeries} viewMode={viewMode} startingBalance={startingBalance} />
    ),
    calendar: (
      <CalendarHeatmap
        dailyPnl={activeDailyPnl}
        viewMode={viewMode}
        startingBalance={startingBalance}
        journaledDates={journaledDates}
      />
    ),
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
        <div className="relative">
          <button
            onClick={() => setShowViewMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-2"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> View: {VIEW_MODE_LABELS[viewMode]}
          </button>
          {showViewMenu && (
            <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-border bg-surface-2 p-1 shadow-lg">
              {(Object.keys(VIEW_MODE_LABELS) as DashboardViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    setShowViewMenu(false);
                  }}
                  disabled={mode === "percent" && startingBalance <= 0}
                  title={
                    mode === "percent" && startingBalance <= 0
                      ? "Set a starting balance on an account to enable percent view"
                      : undefined
                  }
                  className={cn(
                    "block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40",
                    viewMode === mode ? "text-accent" : "text-text",
                  )}
                >
                  {VIEW_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-muted hover:bg-surface-2"
          >
            <Settings2 className="h-3.5 w-3.5" /> Widgets
          </button>
          {showMenu && (
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-border bg-surface-2 p-2 shadow-lg">
              <p className="mb-1 px-2 pb-1 text-[11px] text-text-faint">
                Drag a widget&apos;s handle below to reorder it.
              </p>
              {prefs.order.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface-3"
                >
                  <input
                    type="checkbox"
                    checked={!prefs.hidden.includes(key)}
                    onChange={() => toggleHidden(key)}
                    className="accent-accent"
                  />
                  {WIDGET_LABELS[key]}
                </label>
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
              ref={(el) => {
                if (el) cardRefs.current.set(key, el);
                else cardRefs.current.delete(key);
              }}
              data-widget-card
              onDragOver={handleDragOver(key)}
              onDrop={handleDrop(key)}
              onAnimationEnd={() => setSnappedKey((k) => (k === key ? null : k))}
              className={cn(
                "rounded-lg border bg-surface p-4 transition-[opacity,transform,border-color,box-shadow] duration-150",
                (key === "equityCurve" || key === "drawdown" || key === "stats" || key === "tradeScore") &&
                  "lg:col-span-2",
                draggedKey === key ? "border-border opacity-40" : "border-border",
                dragOverKey === key && draggedKey !== key && "scale-[1.02] border-accent shadow-lg shadow-accent/10",
                snappedKey === key && "animate-widget-snap",
              )}
            >
              <div className="mb-3 flex items-center gap-1.5">
                <span
                  draggable
                  onDragStart={handleDragStart(key)}
                  onDragEnd={handleDragEnd}
                  title="Drag to reorder"
                  className="-ml-1 cursor-grab text-text-faint hover:text-text active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-sm font-medium text-text-muted">{WIDGET_LABELS[key]}</h2>
              </div>
              {widgetContent[key]}
            </div>
          ))}
      </div>
    </div>
  );
}
