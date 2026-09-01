import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "./test-db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

let actions: typeof import("./notebook");
let prisma: typeof import("@/lib/prisma").prisma;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  actions = await import("./notebook");
  ({ prisma } = await import("@/lib/prisma"));
}, 30000);

afterAll(() => cleanup());

describe("notebook actions", () => {
  it("createNote defaults to an empty Tiptap doc and 'Untitled' when title is blank", async () => {
    const note = await actions.createNote({ title: "", folderId: null });
    expect(note.title).toBe("Untitled");
    expect(JSON.parse(note.contentJson)).toMatchObject({ type: "doc" });
  });

  it("createNote seeds content from a template when templateId is given", async () => {
    const template = await prisma.noteTemplate.create({
      data: { name: "Daily Recap", contentJson: JSON.stringify({ type: "doc", content: ["seed"] }), isDefault: false },
    });
    const note = await actions.createNote({ title: "Today", folderId: null, templateId: template.id });
    expect(JSON.parse(note.contentJson)).toEqual({ type: "doc", content: ["seed"] });
  });

  it("updateNote only touches the fields actually passed", async () => {
    const note = await actions.createNote({ title: "Original", folderId: null });
    await actions.updateNote(note.id, { fontSize: 20 });
    const after = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(after.title).toBe("Original");
    expect(after.fontSize).toBe(20);
  });

  it("updateNote with tagNames creates tags and links them, replacing any previous set", async () => {
    const note = await actions.createNote({ title: "Tagged", folderId: null });
    await actions.updateNote(note.id, { tagNames: ["setup", "review"] });
    let tags = await prisma.noteTag.findMany({ where: { noteId: note.id }, include: { tag: true } });
    expect(tags.map((t) => t.tag.name).sort()).toEqual(["review", "setup"]);

    await actions.updateNote(note.id, { tagNames: ["review"] });
    tags = await prisma.noteTag.findMany({ where: { noteId: note.id }, include: { tag: true } });
    expect(tags.map((t) => t.tag.name)).toEqual(["review"]);
  });

  it("deleteFolder unassigns its notes (folderId -> null) instead of deleting them", async () => {
    const folder = await actions.createFolder("Setups", null);
    const note = await actions.createNote({ title: "In folder", folderId: folder.id });
    await actions.deleteFolder(folder.id);

    const after = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(after.folderId).toBeNull();
    expect(await prisma.folder.findUnique({ where: { id: folder.id } })).toBeNull();
  });

  it("generateNoteShareLink is idempotent — a second call returns the same slug", async () => {
    const note = await actions.createNote({ title: "Shared", folderId: null });
    const first = await actions.generateNoteShareLink(note.id);
    const second = await actions.generateNoteShareLink(note.id);
    expect(second).toBe(first);
  });

  it("revokeNoteShareLink clears the slug", async () => {
    const note = await actions.createNote({ title: "Shared", folderId: null });
    await actions.generateNoteShareLink(note.id);
    await actions.revokeNoteShareLink(note.id);
    expect((await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).shareSlug).toBeNull();
  });

  it("saveAsTemplate(isDefault: true) unsets isDefault on every other template", async () => {
    await actions.saveAsTemplate("A", "{}", true);
    const b = await actions.saveAsTemplate("B", "{}", true);

    const templates = await prisma.noteTemplate.findMany();
    const defaults = templates.filter((t) => t.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(b.id);
  });
});
