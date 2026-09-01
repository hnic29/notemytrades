"use client";

import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function JournalDateNav({ dateKey }: { dateKey: string }) {
  const router = useRouter();
  const date = parseISO(dateKey);

  const go = (d: Date) => router.push(`/journal?date=${format(d, "yyyy-MM-dd")}`);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go(addDays(date, -1))}
        className="rounded-md border border-border-strong p-1.5 text-text-muted hover:bg-surface-2"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="date"
        value={dateKey}
        onChange={(e) => e.target.value && router.push(`/journal?date=${e.target.value}`)}
        className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-accent"
      />
      <button
        onClick={() => go(addDays(date, 1))}
        className="rounded-md border border-border-strong p-1.5 text-text-muted hover:bg-surface-2"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        onClick={() => go(new Date())}
        className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
      >
        Today
      </button>
    </div>
  );
}
