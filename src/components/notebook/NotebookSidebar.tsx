"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { FolderPlus, FilePlus, Folder as FolderIcon, Trash2 } from "lucide-react";
import { createFolder, createNote, deleteFolder } from "@/lib/actions/notebook";
import { cn } from "@/lib/utils";

type FolderRow = { id: string; name: string };
type NoteRow = { id: string; title: string; folderId: string | null; updatedAt: Date };
type TemplateRow = { id: string; name: string };

export function NotebookSidebar({
  folders,
  notes,
  templates,
}: {
  folders: FolderRow[];
  notes: NoteRow[];
  templates: TemplateRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolder = searchParams.get("folder");
  const activeNote = searchParams.get("note");
  const [isPending, startTransition] = useTransition();

  const goToFolder = (folderId: string | null) => {
    const params = new URLSearchParams();
    if (folderId) params.set("folder", folderId);
    router.push(`/notebook${params.toString() ? `?${params}` : ""}`);
  };

  const handleNewFolder = () => {
    const name = window.prompt("Folder name");
    if (!name) return;
    startTransition(() => {
      createFolder(name, null);
    });
  };

  const handleDeleteFolder = (id: string) => {
    if (!window.confirm("Delete this folder? Notes inside will be moved to Unfiled.")) return;
    startTransition(async () => {
      await deleteFolder(id);
      if (activeFolder === id) goToFolder(null);
    });
  };

  const handleNewNote = (templateId?: string) => {
    startTransition(async () => {
      const note = await createNote({
        title: "Untitled",
        folderId: activeFolder,
        templateId: templateId ?? null,
      });
      const params = new URLSearchParams();
      if (activeFolder) params.set("folder", activeFolder);
      params.set("note", note.id);
      router.push(`/notebook?${params}`);
    });
  };

  const visibleNotes = notes.filter((n) => (activeFolder ? n.folderId === activeFolder : true));

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border">
      <div className="flex items-center justify-between border-b border-border p-3">
        <span className="text-xs font-medium uppercase tracking-wide text-text-faint">
          Notebook
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleNewFolder}
            title="New folder"
            className="rounded p-1 text-text-faint hover:bg-surface-2 hover:text-text"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          {templates.length === 0 ? (
            <button
              onClick={() => handleNewNote()}
              title="New note"
              disabled={isPending}
              className="rounded p-1 text-text-faint hover:bg-surface-2 hover:text-text"
            >
              <FilePlus className="h-4 w-4" />
            </button>
          ) : (
            <select
              onChange={(e) => {
                if (e.target.value === "__blank") handleNewNote();
                else if (e.target.value) handleNewNote(e.target.value);
                e.target.value = "";
              }}
              defaultValue=""
              title="New note"
              className="rounded border border-border-strong bg-surface text-xs text-text-faint"
            >
              <option value="" disabled>
                + New
              </option>
              <option value="__blank">Blank note</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  From: {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="overflow-y-auto p-2">
        <button
          onClick={() => goToFolder(null)}
          className={cn(
            "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
            !activeFolder ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2",
          )}
        >
          All Notes
        </button>
        {folders.map((f) => (
          <div key={f.id} className="group flex items-center">
            <button
              onClick={() => goToFolder(f.id)}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                activeFolder === f.id ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2",
              )}
            >
              <FolderIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{f.name}</span>
            </button>
            <button
              onClick={() => handleDeleteFolder(f.id)}
              className="hidden shrink-0 rounded p-1 text-text-faint hover:text-loss group-hover:block"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        <div className="mt-3 border-t border-border pt-2">
          {visibleNotes.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-text-faint">No notes here yet.</p>
          ) : (
            visibleNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (activeFolder) params.set("folder", activeFolder);
                  params.set("note", n.id);
                  router.push(`/notebook?${params}`);
                }}
                className={cn(
                  "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
                  activeNote === n.id ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2",
                )}
              >
                {n.title || "Untitled"}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
