"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDashboardValue, formatDate, type DashboardViewMode } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RecentTrade = {
  id: string;
  symbol: string;
  openedAt: Date;
  netPnl: number;
  /** Null when the trade had no stop loss set — nothing to show in R-Multiple view. */
  rMultiple: number | null;
  status: string;
};

export function RecentTradesWidget({
  recent,
  open,
  viewMode,
  startingBalance,
}: {
  recent: RecentTrade[];
  open: RecentTrade[];
  viewMode: DashboardViewMode;
  startingBalance: number;
}) {
  const [tab, setTab] = useState<"recent" | "open">("recent");
  const rows = tab === "recent" ? recent : open;

  return (
    <div>
      <div className="mb-3 flex gap-1">
        <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
          Recent Trades
        </TabButton>
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          Open Positions {open.length > 0 && `(${open.length})`}
        </TabButton>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-faint">
          {tab === "recent" ? "No trades yet." : "No open positions."}
        </p>
      ) : (
        <div className="space-y-1">
          {rows.map((t) => (
            <Link
              key={t.id}
              href={`/trades/${t.id}`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
            >
              <span className="font-medium text-text">{t.symbol}</span>
              <span className="text-xs text-text-faint">{formatDate(t.openedAt)}</span>
              {tab === "open" ? (
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] uppercase text-text-muted">
                  Open
                </span>
              ) : viewMode === "rMultiple" && t.rMultiple == null ? (
                <span className="text-xs text-text-faint">no stop set</span>
              ) : (
                <span className={cn("font-medium", t.netPnl >= 0 ? "text-profit" : "text-loss")}>
                  {formatDashboardValue(
                    viewMode === "rMultiple" ? (t.rMultiple ?? 0) : t.netPnl,
                    viewMode,
                    startingBalance,
                  )}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/trades"
        className="mt-3 block text-center text-xs text-accent hover:underline"
      >
        View all trades →
      </Link>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-surface-2 text-text" : "text-text-faint hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
