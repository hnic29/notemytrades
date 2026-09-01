"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { setTradeState } from "@/lib/actions/progress";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Rule = { id: string; name: string };
type Trade = { id: string; symbol: string; openedAt: Date };

export function TradeChecklist({
  rules,
  trades,
  states,
}: {
  rules: Rule[];
  trades: Trade[];
  states: Record<string, Record<string, boolean>>; // tradeId -> ruleId -> passed
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rules.length === 0) {
    return (
      <p className="text-sm text-text-faint">
        No per-trade rules yet — add one below to check them off against recent trades.
      </p>
    );
  }
  if (trades.length === 0) {
    return <p className="text-sm text-text-faint">No trades logged yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-text-faint">
            <th className="px-3 py-2">Trade</th>
            {rules.map((r) => (
              <th key={r.id} className="px-3 py-2 text-center">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 text-text-muted">
                {t.symbol} <span className="text-text-faint">· {formatDate(t.openedAt)}</span>
              </td>
              {rules.map((r) => {
                const passed = states[t.id]?.[r.id];
                return (
                  <td key={r.id} className="px-3 py-2 text-center">
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await setTradeState(
                            r.id,
                            t.id,
                            t.openedAt.toISOString().slice(0, 10),
                            !(passed === true),
                          );
                          router.refresh();
                        })
                      }
                      className={cn(
                        "mx-auto flex h-5 w-5 items-center justify-center rounded border",
                        passed === true && "border-profit bg-profit text-accent-fg",
                        passed === false && "border-loss bg-loss-bg",
                        passed === undefined && "border-border-strong hover:bg-surface-2",
                      )}
                    >
                      {passed === true && <Check className="h-3 w-3" />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
