"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useActiveNav } from "./useActiveNav";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";

/** Hamburger top bar + slide-in drawer, shown only below the `md`
 * breakpoint — the Sidebar is `hidden md:flex`, so without this the
 * entire nav disappears on a phone-width screen. */
export function MobileNav() {
  const { isActive, setOptimisticHref } = useActiveNav();
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open, and always close it on
  // an actual route change (covers back/forward nav too, not just link clicks).
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleNavigate = (href: string) => {
    setOptimisticHref(href);
    setOpen(false);
  };

  return (
    <div className="md:hidden">
      <div className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={() => handleNavigate("/dashboard")}>
          <Logo className="h-[44px] w-[44px] shrink-0 object-contain" />
          <span className="text-sm font-semibold tracking-tight text-text">Note My Trades</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-md p-2 text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-72 max-w-[80vw] flex-col border-r border-border bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-text">
                <Logo className="h-[38px] w-[38px] shrink-0 object-contain" />
                Note My Trades
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-2 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks isActive={isActive} onNavigate={handleNavigate} />
          </div>
        </div>
      )}
    </div>
  );
}
