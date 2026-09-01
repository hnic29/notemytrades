"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2, Pencil, Link2, Link2Off } from "lucide-react";
import {
  deleteStrategy,
  generateStrategyShareLink,
  revokeStrategyShareLink,
} from "@/lib/actions/strategies";

export function StrategyDetailActions({
  strategyId,
  shareSlug,
}: {
  strategyId: string;
  shareSlug: string | null;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(shareSlug);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const shareUrl =
    slug && typeof window !== "undefined" ? `${window.location.origin}/s/strategies/${slug}` : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => router.push(`/strategies/${strategyId}/edit`)}
        className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text hover:bg-surface-2"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>

      {slug ? (
        <>
          <button
            onClick={() => {
              if (shareUrl) {
                navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
            className="flex items-center gap-1.5 rounded-md border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
          >
            <Link2 className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy Share Link"}
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                await revokeStrategyShareLink(strategyId);
                setSlug(null);
              })
            }
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2 disabled:opacity-50"
          >
            <Link2Off className="h-3.5 w-3.5" /> Revoke
          </button>
        </>
      ) : (
        <button
          onClick={() =>
            startTransition(async () => {
              setSlug(await generateStrategyShareLink(strategyId));
            })
          }
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2 disabled:opacity-50"
        >
          <Link2 className="h-3.5 w-3.5" /> Share
        </button>
      )}

      <button
        onClick={() =>
          startTransition(async () => {
            if (!window.confirm("Delete this strategy? Attached trades will be unassigned.")) return;
            await deleteStrategy(strategyId);
            router.push("/strategies");
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
