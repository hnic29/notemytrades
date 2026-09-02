import { notFound } from "next/navigation";
import { getNoteByShareSlug } from "@/lib/queries/notebook";
import { Editor } from "@/components/notebook/Editor";
import { Logo } from "@/components/layout/Logo";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SharedNotePage(props: PageProps<"/s/notes/[slug]">) {
  const { slug } = await props.params;
  const note = await getNoteByShareSlug(slug);
  if (!note) notFound();

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-text-faint">
          <Logo className="h-[38px] w-[38px] shrink-0 object-contain" />
          Shared from Note My Trades
        </div>

        <h1 className="mb-1 text-2xl font-semibold">{note.title || "Untitled"}</h1>
        <p className="mb-6 text-sm text-text-faint">{formatDate(note.updatedAt)}</p>

        {note.tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {note.tags.map((t) => (
              <span
                key={t.tag.id}
                className="rounded-full border border-border-strong px-2.5 py-1 text-xs text-text-muted"
              >
                {t.tag.name}
              </span>
            ))}
          </div>
        )}

        <Editor content={JSON.parse(note.contentJson)} fontSize={note.fontSize} editable={false} />
      </div>
    </div>
  );
}
