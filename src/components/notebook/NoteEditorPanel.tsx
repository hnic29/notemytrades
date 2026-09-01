"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { Trash2, Link2, Link2Off, Printer, BookmarkPlus, Minus, Plus } from "lucide-react";
import {
  deleteNote,
  generateNoteShareLink,
  revokeNoteShareLink,
  saveAsTemplate,
  updateNote,
} from "@/lib/actions/notebook";
import { Editor } from "./Editor";
import { TradeLinkPicker } from "./TradeLinkPicker";

export type NoteData = {
  id: string;
  title: string;
  contentJson: string;
  fontSize: number;
  shareSlug: string | null;
  tags: { tag: { name: string } }[];
  trade: { id: string; symbol: string } | null;
};

export function NoteEditorPanel({ note }: { note: NoteData }) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState<JSONContent>(JSON.parse(note.contentJson));
  const [fontSize, setFontSize] = useState(note.fontSize);
  const [tagsText, setTagsText] = useState(note.tags.map((t) => t.tag.name).join(", "));
  const [shareSlug, setShareSlug] = useState(note.shareSlug);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      await updateNote(note.id, {
        title,
        contentJson: JSON.stringify(content),
        fontSize,
        tagNames: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  const shareUrl =
    shareSlug && typeof window !== "undefined" ? `${window.location.origin}/s/notes/${shareSlug}` : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Untitled"
          className="mb-3 w-full bg-transparent text-2xl font-semibold text-text outline-none placeholder:text-text-faint"
        />

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={save}
            disabled={isPending || !dirty}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-40"
          >
            {isPending ? "Saving…" : saved ? "Saved" : "Save"}
          </button>

          <div className="flex items-center gap-1 rounded-md border border-border-strong px-1.5 py-1">
            <button
              onClick={() => setFontSize((s) => Math.max(12, s - 1))}
              className="text-text-faint hover:text-text"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-text-muted">{fontSize}</span>
            <button
              onClick={() => setFontSize((s) => Math.min(28, s + 1))}
              className="text-text-faint hover:text-text"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {shareSlug ? (
            <>
              <button
                onClick={() => shareUrl && navigator.clipboard.writeText(shareUrl)}
                className="flex items-center gap-1 rounded-md border border-accent/40 px-2.5 py-1.5 text-accent hover:bg-accent/10"
              >
                <Link2 className="h-3 w-3" /> Copy Share Link
              </button>
              <button
                onClick={() =>
                  startTransition(async () => {
                    await revokeNoteShareLink(note.id);
                    setShareSlug(null);
                  })
                }
                className="flex items-center gap-1 rounded-md border border-border-strong px-2.5 py-1.5 text-text-muted hover:bg-surface-2"
              >
                <Link2Off className="h-3 w-3" /> Revoke
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                startTransition(async () => {
                  setShareSlug(await generateNoteShareLink(note.id));
                })
              }
              className="flex items-center gap-1 rounded-md border border-border-strong px-2.5 py-1.5 text-text-muted hover:bg-surface-2"
            >
              <Link2 className="h-3 w-3" /> Share
            </button>
          )}

          <a
            href={`/notebook/${note.id}/print`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-border-strong px-2.5 py-1.5 text-text-muted hover:bg-surface-2"
          >
            <Printer className="h-3 w-3" /> Print / PDF
          </a>

          <button
            onClick={() => {
              const name = window.prompt("Template name", title || "Untitled template");
              if (!name) return;
              const isDefault = window.confirm("Use this as the default template for new notes?");
              startTransition(() => {
                saveAsTemplate(name, JSON.stringify(content), isDefault);
              });
            }}
            className="flex items-center gap-1 rounded-md border border-border-strong px-2.5 py-1.5 text-text-muted hover:bg-surface-2"
          >
            <BookmarkPlus className="h-3 w-3" /> Save as Template
          </button>

          <button
            onClick={() => {
              if (!window.confirm("Delete this note?")) return;
              startTransition(async () => {
                await deleteNote(note.id);
                router.push("/notebook");
              });
            }}
            className="ml-auto flex items-center gap-1 rounded-md border border-loss/40 px-2.5 py-1.5 text-loss hover:bg-loss-bg"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>

        <div className="mb-4">
          <TradeLinkPicker noteId={note.id} linkedTrade={note.trade} />
        </div>

        <input
          value={tagsText}
          onChange={(e) => {
            setTagsText(e.target.value);
            setDirty(true);
          }}
          placeholder="Tags (comma separated)"
          className="mb-4 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />

        <Editor
          content={content}
          fontSize={fontSize}
          onChange={(json) => {
            setContent(json);
            setDirty(true);
          }}
        />
      </div>
    </div>
  );
}
