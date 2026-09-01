"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export function CalendarHeatmap({ dailyPnl }: { dailyPnl: Record<string, number> }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const weeks = useMemo(() => {
    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, [days]);

  const maxAbs = useMemo(
    () => Math.max(1, ...Object.values(dailyPnl).map((v) => Math.abs(v))),
    [dailyPnl],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="rounded p-1 text-text-faint hover:bg-surface-2 hover:text-text"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-text">{format(month, "MMMM yyyy")}</span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded p-1 text-text-faint hover:bg-surface-2 hover:text-text"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-[repeat(7,1fr)_4.5rem] gap-1 text-center text-[10px] text-text-faint">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
        <div>Week</div>
      </div>

      <div className="mt-1 space-y-1">
        {weeks.map((week, wi) => {
          const weekTotal = week.reduce((sum, day) => {
            const key = format(day, "yyyy-MM-dd");
            return sum + (dailyPnl[key] ?? 0);
          }, 0);
          const tradingDayCount = week.filter((day) => dailyPnl[format(day, "yyyy-MM-dd")] != null).length;

          return (
            <div key={wi} className="grid grid-cols-[repeat(7,1fr)_4.5rem] gap-1">
              {week.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const pnl = dailyPnl[key];
                const inMonth = isSameMonth(day, month);
                const intensity = pnl ? Math.min(Math.abs(pnl) / maxAbs, 1) : 0;

                return (
                  <Link
                    key={key}
                    href={`/journal?date=${key}`}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded text-[10px] transition-colors",
                      !inMonth && "opacity-30",
                      isToday(day) && "ring-1 ring-accent",
                      pnl == null && "bg-surface-2 text-text-faint",
                      pnl != null && pnl > 0 && "text-profit",
                      pnl != null && pnl < 0 && "text-loss",
                    )}
                    style={
                      pnl != null
                        ? {
                            backgroundColor:
                              pnl > 0
                                ? `rgba(34,197,94,${0.12 + intensity * 0.35})`
                                : `rgba(244,63,94,${0.12 + intensity * 0.35})`,
                          }
                        : undefined
                    }
                  >
                    <span className="text-text-muted">{format(day, "d")}</span>
                    {pnl != null && (
                      <span className="font-medium">{formatCurrency(pnl).replace(".00", "")}</span>
                    )}
                  </Link>
                );
              })}
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded bg-surface-2 text-[10px]",
                  tradingDayCount === 0 && "text-text-faint",
                  tradingDayCount > 0 && weekTotal >= 0 && "text-profit",
                  tradingDayCount > 0 && weekTotal < 0 && "text-loss",
                )}
              >
                {tradingDayCount > 0 ? (
                  <>
                    <span className="font-medium">{formatCurrency(weekTotal).replace(".00", "")}</span>
                    <span className="text-text-faint">
                      {tradingDayCount} day{tradingDayCount === 1 ? "" : "s"}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
