import { listFolders, listNotes, listTemplates, getNote } from "@/lib/queries/notebook";
import { NotebookSidebar } from "@/components/notebook/NotebookSidebar";
import { NoteEditorPanel } from "@/components/notebook/NoteEditorPanel";

export default async function NotebookPage(props: PageProps<"/notebook">) {
  const searchParams = await props.searchParams;
  const noteId = typeof searchParams.note === "string" ? searchParams.note : null;

  const [folders, notes, templates, activeNote] = await Promise.all([
    listFolders(),
    listNotes(),
    listTemplates(),
    noteId ? getNote(noteId) : null,
  ]);

  return (
    <div className="-mx-4 -my-6 flex h-screen md:-mx-8 md:-my-8">
      <NotebookSidebar
        folders={folders}
        notes={notes.map((n) => ({
          id: n.id,
          title: n.title,
          folderId: n.folderId,
          updatedAt: n.updatedAt,
        }))}
        templates={templates}
      />
      {activeNote ? (
        <NoteEditorPanel
          note={{
            id: activeNote.id,
            title: activeNote.title,
            contentJson: activeNote.contentJson,
            fontSize: activeNote.fontSize,
            shareSlug: activeNote.shareSlug,
            tags: activeNote.tags,
            trade: activeNote.trade,
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-text-faint">
          Select a note, or create a new one.
        </div>
      )}
    </div>
  );
}
