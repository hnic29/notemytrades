"use client";

import Link from "next/link";
import { useActiveNav } from "./useActiveNav";
import { NavLinks } from "./NavLinks";

export function Sidebar() {
  const { isActive, setOptimisticHref } = useActiveNav();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <Link
        href="/dashboard"
        onClick={() => setOptimisticHref("/dashboard")}
        className="flex h-14 items-center gap-2 border-b border-border px-4 hover:bg-surface-2"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-fg">
          N
        </div>
        <span className="text-sm font-semibold tracking-tight text-text">
          Note My Trades
        </span>
      </Link>

      <NavLinks isActive={isActive} onNavigate={setOptimisticHref} />
    </aside>
  );
}
