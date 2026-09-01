"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { setDailyState } from "@/lib/actions/progress";
import { cn } from "@/lib/utils";

type Rule = { id: string; name: string };

export function DailyCheckin({
  dateKey,
  rules,
  states,
}: {
  dateKey: string;
  rules: Rule[];
  states: Record<string, boolean>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rules.length === 0) {
    return (
      <p className="text-sm text-text-faint">
        No daily rules yet — add one below to start a check-in.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {rules.map((r) => {
        const state = states[r.id];
        return (
          <button
            key={r.id}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setDailyState(r.id, dateKey, !(state === true));
                router.refresh();
              })
            }
            className={cn(
              "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
              state === true && "border-profit/40 bg-profit-bg text-text",
              state === false && "border-loss/40 bg-loss-bg text-text",
              state === undefined && "border-border-strong text-text-muted hover:bg-surface-2",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                state === true ? "border-profit bg-profit text-accent-fg" : "border-border-strong",
              )}
            >
              {state === true && <Check className="h-3 w-3" />}
            </span>
            {r.name}
          </button>
        );
      })}
    </div>
  );
}
