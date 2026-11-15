import { eq } from "drizzle-orm";

import { db } from "#/server/db";
import { type AttachedFile, draft } from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

import { type Author, checkContent, read, type Updated, update } from "./index";

/** One replacement: `old` must appear exactly once, unless `all` replaces every occurrence. */
export type Edit = { old: string; new: string; all?: boolean };

export type Draft = {
  baseVersion: number;
  markdown: string;
  files: AttachedFile[];
  edits: number;
  authorName: string;
  updatedAt: Date;
};

/** Applies edits in order, each to the result of the one before. */
export function applyEdits(source: string, edits: Edit[]): string {
  return edits.reduce((text, edit, index) => {
    const which = edits.length > 1 ? `Edit ${index + 1}: ` : "";
    if (!edit.old) throw new EvergardenError("invalid", `${which}\`old\` is empty.`);
    const found = text.split(edit.old).length - 1;
    if (found === 0) {
      throw new EvergardenError("invalid", `${which}\`old\` does not appear in the draft.`);
    }
    if (found > 1 && !edit.all) {
      throw new EvergardenError(
        "invalid",
        `${which}\`old\` appears ${found} times. Include more of the text around it, or set \`all\`.`,
      );
    }
    return edit.all ? text.replaceAll(edit.old, edit.new) : text.replace(edit.old, () => edit.new);
  }, source);
}

export async function getDraft(id: string): Promise<Draft | null> {
  const row = await db
    .select({
      baseVersion: draft.baseVersion,
      markdown: draft.markdown,
      files: draft.files,
      edits: draft.edits,
      authorName: draft.authorName,
      updatedAt: draft.updatedAt,
    })
    .from(draft)
    .where(eq(draft.documentId, id))
    .get();
  return row ?? null;
}

type Contents = { markdown: string; files: AttachedFile[] };

/**
 * Changes the document's draft, starting one from the current version when there is none.
 * `changes` counts what the draft holds, for the notice the owner sees.
 */
export async function changeDraft(
  id: string,
  author: Author,
  changes: number,
  change: (base: Contents) => Contents | Promise<Contents>,
): Promise<Draft> {
  const existing = await getDraft(id);
  const base = existing ?? (await startingPoint(id));
  const next = await change(base);
  const row = {
    documentId: id,
    baseVersion: base.baseVersion,
    markdown: checkContent(next.markdown),
    files: next.files,
    edits: (existing?.edits ?? 0) + changes,
    authorKind: author.kind,
    authorId: author.id,
    authorName: author.name,
    updatedAt: new Date(),
  };
  await db.insert(draft).values(row).onConflictDoUpdate({ target: draft.documentId, set: row });
  return row;
}

export function editDraft(id: string, edits: Edit[], author: Author): Promise<Draft> {
  return changeDraft(id, author, edits.length, (base) => ({
    markdown: applyEdits(base.markdown, edits),
    files: base.files,
  }));
}

/**
 * Saves the draft as the next version, credited to whoever wrote it, even when the owner
 * publishes it. Fails when a version was published since the draft began.
 */
export async function publishDraft(id: string): Promise<Updated> {
  const current = await db.select().from(draft).where(eq(draft.documentId, id)).get();
  if (!current) throw new EvergardenError("not_found", `Document "${id}" has no draft.`);
  const author = { kind: current.authorKind, id: current.authorId, name: current.authorName };
  const result = await update(
    id,
    { content: current.markdown, baseVersion: current.baseVersion, files: current.files },
    author,
  );
  await discardDraft(id);
  return result;
}

export async function discardDraft(id: string): Promise<void> {
  await db.delete(draft).where(eq(draft.documentId, id));
}

async function startingPoint(id: string) {
  const current = await read(id);
  return { baseVersion: current.document.version, markdown: current.source, files: current.files };
}
