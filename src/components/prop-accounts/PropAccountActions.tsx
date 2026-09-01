"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deletePropAccount, setPhase } from "@/lib/actions/prop-accounts";
import { cn } from "@/lib/utils";

const PHASES = [
  { value: "challenge", label: "Challenge" },
  { value: "verification", label: "Verification" },
  { value: "funded", label: "Funded" },
];

export function PropAccountActions({
  propAccountId,
  phase,
}: {
  propAccountId: string;
  phase: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(phase);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PHASES.map((p) => (
        <button
          key={p.value}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await setPhase(propAccountId, p.value);
              setCurrent(p.value);
            })
          }
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm",
            current === p.value
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border-strong text-text-muted hover:bg-surface-2",
          )}
        >
          {p.label}
        </button>
      ))}

      <button
        onClick={() => router.push(`/prop-accounts/${propAccountId}/edit`)}
        className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text hover:bg-surface-2"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>

      <button
        onClick={() =>
          startTransition(async () => {
            if (!window.confirm("Delete this prop account? This also removes its trade history."))
              return;
            await deletePropAccount(propAccountId);
            router.push("/prop-accounts");
          })
        }
        disabled={isPending}
        className="ml-auto flex items-center gap-1.5 rounded-md border border-loss/40 px-3 py-1.5 text-sm text-loss hover:bg-loss-bg disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
    </div>
  );
}
