"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  // Next's router occasionally commits the new route's content a tick
  // before this shared-layout component re-renders with the new
  // pathname (observed on 16.3.4), which briefly highlights the old nav
  // item. Set the highlight synchronously on click and let it clear
  // itself once `pathname` actually catches up, so it can never get
  // stuck out of sync with real navigation state.
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  useEffect(() => {
    setOptimisticHref(null);
  }, [pathname]);
  const activePath = optimisticHref ?? pathname;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-fg">
          N
        </div>
        <span className="text-sm font-semibold tracking-tight text-text">
          Note My Trades
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            activePath === item.href || activePath.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOptimisticHref(item.href)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-2 text-text"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-accent" : "text-text-faint",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 text-xs text-text-faint">
        Self-hosted · no subscription
      </div>
    </aside>
  );
}
