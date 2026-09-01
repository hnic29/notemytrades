"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2, Pencil, Link2, Link2Off } from "lucide-react";
import { deleteTrade, generateShareLink, revokeShareLink } from "@/lib/actions/trades";

export function TradeDetailActions({
  tradeId,
  shareSlug,
}: {
  tradeId: string;
  shareSlug: string | null;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(shareSlug);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const shareUrl = slug && typeof window !== "undefined"
    ? `${window.location.origin}/s/trades/${slug}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => router.push(`/trades/${tradeId}/edit`)}
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
                await revokeShareLink(tradeId);
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
              const newSlug = await generateShareLink(tradeId);
              setSlug(newSlug);
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
            if (!window.confirm("Delete this trade? This can't be undone.")) return;
            await deleteTrade(tradeId);
            router.push("/trades");
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
