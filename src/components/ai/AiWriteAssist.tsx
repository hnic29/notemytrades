"use client";

import { useState, useTransition } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { Sparkles } from "lucide-react";
import { generateNoteAssist } from "@/lib/actions/ai";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { key: "continue", label: "Continue" },
  { key: "improve", label: "Improve" },
  { key: "summarize", label: "Summarize" },
] as const;

export function AiWriteAssist({ editor }: { editor: TiptapEditor | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: (typeof ACTIONS)[number]["key"]) => {
    if (!editor) return;
    setError(null);
    setPendingAction(action);
    const text = editor.getText();

    startTransition(async () => {
      const result = await generateNoteAssist(text, action);
      if (result.ok) {
        if (action === "continue") {
          editor.chain().focus("end").insertContent(` ${result.text}`).run();
        } else {
          editor.chain().focus().selectAll().insertContent(result.text).run();
        }
      } else {
        setError(result.error);
      }
      setPendingAction(null);
    });
  };

  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-text-faint" />
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            disabled={isPending || !editor}
            onClick={() => run(a.key)}
            className={cn(
              "rounded-md border border-border-strong px-2.5 py-1 text-xs text-text-muted hover:bg-surface-2 disabled:opacity-50",
            )}
          >
            {isPending && pendingAction === a.key ? "Thinking…" : a.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-loss">{error}</p>}
    </div>
  );
}
