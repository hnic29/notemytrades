import { notFound } from "next/navigation";
import { getNote } from "@/lib/queries/notebook";
import { Editor } from "@/components/notebook/Editor";
import { PrintTrigger } from "@/components/notebook/PrintTrigger";
import { formatDate } from "@/lib/format";

const LIGHT_THEME = {
  "--color-bg": "#ffffff",
  "--color-surface": "#ffffff",
  "--color-surface-2": "#f3f4f6",
  "--color-border": "#e5e7eb",
  "--color-border-strong": "#d1d5db",
  "--color-text": "#111827",
  "--color-text-muted": "#4b5563",
  "--color-text-faint": "#9ca3af",
  "--color-accent": "#0d9488",
} as React.CSSProperties;

export default async function PrintNotePage(props: PageProps<"/notebook/[id]/print">) {
  const { id } = await props.params;
  const note = await getNote(id);
  if (!note) notFound();

  return (
    <div style={LIGHT_THEME} className="min-h-screen bg-bg px-8 py-10 text-text">
      <PrintTrigger />
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-semibold">{note.title || "Untitled"}</h1>
        <p className="mb-6 text-sm text-text-faint">{formatDate(note.updatedAt)}</p>
        <Editor content={JSON.parse(note.contentJson)} fontSize={note.fontSize} editable={false} />
      </div>
    </div>
  );
}
