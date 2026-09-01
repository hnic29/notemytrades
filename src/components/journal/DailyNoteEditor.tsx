"use client";

import { useState, useTransition } from "react";
import { saveDailyNote } from "@/lib/actions/daily-notes";

export function DailyNoteEditor({
  dateKey,
  initialText,
}: {
  dateKey: string;
  initialText: string;
}) {
  const [text, setText] = useState(initialText);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      await saveDailyNote(dateKey, text);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={6}
        placeholder="What happened today? Market conditions, mindset, mistakes, lessons…"
        className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Note"}
        </button>
        {saved && <span className="text-xs text-profit">Saved</span>}
      </div>
    </div>
  );
}
