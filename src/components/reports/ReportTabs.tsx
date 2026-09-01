"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/reports", label: "Overview" },
  { href: "/reports/day-time", label: "Day & Time" },
  { href: "/reports/symbol", label: "Symbol" },
  { href: "/reports/win-loss", label: "Win vs Losses" },
  { href: "/reports/tags", label: "Tags" },
  { href: "/reports/playbook", label: "Playbook" },
  { href: "/reports/risk", label: "Risk" },
  { href: "/reports/options", label: "Options" },
  { href: "/reports/compare", label: "Compare" },
];

export function ReportTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${qs ? `?${qs}` : ""}`}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm transition-colors",
              active
                ? "border-b-2 border-accent text-text"
                : "text-text-muted hover:text-text",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
