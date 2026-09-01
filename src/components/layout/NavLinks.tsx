"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** The nav item list + Settings footer link, shared by the desktop
 * Sidebar and the mobile drawer so the two never drift apart. */
export function NavLinks({
  isActive,
  onNavigate,
}: {
  isActive: (href: string) => boolean;
  /** Called after any link click — the mobile drawer uses this to close itself. */
  onNavigate: (href: string) => void;
}) {
  return (
    <>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate(item.href)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-2 text-text"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-text-faint")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <Link
          href="/settings"
          onClick={() => onNavigate("/settings")}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
            isActive("/settings")
              ? "bg-surface-2 text-text"
              : "text-text-muted hover:bg-surface-2 hover:text-text",
          )}
        >
          <Settings className={cn("h-4 w-4 shrink-0", isActive("/settings") ? "text-accent" : "text-text-faint")} />
          Settings
        </Link>
        <p className="px-3 pt-1 text-xs text-text-faint">Self-hosted · no subscription</p>
      </div>
    </>
  );
}
