import { and, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

import { retitle } from "#/render/retitle";
import { db } from "#/server/db";
import { document, folder, sharing } from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

import {
  childFolder,
  documentFolderPath,
  ensureFolder,
  findFolder,
  firstDocumentPosition,
  folderPath,
  lastFolderPosition,
  parseFolderPath,
} from "./folders";
import { type Author, getDocument, read, type Updated, update } from "./index";
import { unindex } from "./search";

/** How long deleted documents wait in the trash before they are gone for good. */
export const TRASH_DAYS = 30;

const MAX_TITLE_LENGTH = 200;

/** Moves a document to the top of another folder, or of the library with `null`. */
export async function moveDocument(id: string, folderId: string | null): Promise<void> {
  await getDocument(id);
  if (folderId) await getFolder(folderId);
  await db
    .update(document)
    .set({ folderId, position: await firstDocumentPosition(folderId) })
    .where(eq(document.id, id));
}

/** Renames a document by saving a version whose markdown carries the new title. */
export async function renameDocument(id: string, title: string, author: Author): Promise<Updated> {
  const name = title.replace(/\s+/g, " ").trim();
  if (!name || name.length > MAX_TITLE_LENGTH) {
    throw new EvergardenError("invalid", `A title is 1 to ${MAX_TITLE_LENGTH} characters.`);
  }
  const current = await read(id);
  return update(
    id,
    { content: retitle(current.source, name), baseVersion: current.document.version },
    author,
  );
}

type FolderRow = { id: string; parentId: string | null; name: string };

async function getFolder(id: string): Promise<FolderRow> {
  const found = await db
    .select({ id: folder.id, parentId: folder.parentId, name: folder.name })
    .from(folder)
    .where(eq(folder.id, id))
    .get();
  if (!found) throw new EvergardenError("not_found", `No folder with id "${id}".`);
  return found;
}

/** Two folders with one name in one place would make paths such as "reports/2026" ambiguous. */
async function assertNameFree(parentId: string | null, name: string, self: string) {
  const taken = await childFolder(parentId, name);
  if (taken && taken !== self) {
    throw new EvergardenError("conflict", `There is already a folder named "${name}" there.`);
  }
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const [clean, ...rest] = parseFolderPath(name);
  if (!clean || rest.length > 0) {
    throw new EvergardenError("invalid", "A folder name is not empty and has no slash.");
  }
  const current = await getFolder(id);
  await assertNameFree(current.parentId, clean, id);
  await db.update(folder).set({ name: clean }).where(eq(folder.id, id));
}

/** Moves a folder, with everything in it, to the end of another folder or of the library. */
export async function moveFolder(id: string, parentId: string | null): Promise<void> {
  const current = await getFolder(id);
  if (parentId) {
    await getFolder(parentId);
    const above = await folderPath(parentId);
    if (above.some((step) => step.id === id)) {
      throw new EvergardenError("invalid", "A folder cannot go inside itself.");
    }
  }
  await assertNameFree(parentId, current.name, id);
  await db
    .update(folder)
    .set({ parentId, position: generateKeyBetween(await lastFolderPosition(parentId), null) })
    .where(eq(folder.id, id));
}

/** Where a path such as "reports/2026" points, creating the folders it names; "" is the top. */
export function folderAt(path: string): Promise<string | null> {
  return ensureFolder(parseFolderPath(path));
}

/** Finds an existing folder by path, for tools that name folders rather than ids. */
export async function existingFolder(path: string): Promise<string> {
  const names = parseFolderPath(path);
  if (names.length === 0) {
    throw new EvergardenError("invalid", "Name a folder, not the top of the library.");
  }
  const id = await findFolder(names);
  if (!id) throw new EvergardenError("not_found", `No folder at "${path}".`);
  return id;
}

/** Stops sharing what goes to the trash, so restoring it never reopens it to anyone. */
function unshare(kind: "document" | "folder", ids: string[]) {
  return db
    .delete(sharing)
    .where(and(eq(sharing.targetKind, kind), inArray(sharing.targetId, ids)));
}

export async function deleteDocument(id: string): Promise<void> {
  await getDocument(id);
  const path = await documentFolderPath(id);
  await db.batch([
    db
      .update(document)
      .set({ deletedAt: new Date(), deletedFrom: path.map((step) => step.name).join("/") || null })
      .where(eq(document.id, id)),
    unshare("document", [id]),
  ]);
}

/**
 * Sends every document under a folder to the trash, each remembering its path, then removes the
 * folders. Restoring a document brings back the folders it needs.
 */
export async function deleteFolder(id: string): Promise<void> {
  await getFolder(id);
  const top = (await folderPath(id)).map((step) => step.name).join("/");
  const subtree = await db.all<{ id: string; path: string }>(sql`
    with recursive down(id, path) as (
      select id, ${top} from folder where id = ${id}
      union all
      select folder.id, down.path || '/' || folder.name from folder join down on folder.parent_id = down.id
    )
    select id, path from down
  `);
  const folderIds = subtree.map((row) => row.id);
  const living = await db
    .select({ id: document.id, folderId: document.folderId })
    .from(document)
    .where(and(inArray(document.folderId, folderIds), isNull(document.deletedAt)))
    .all();
  const pathOf = new Map(subtree.map((row) => [row.id, row.path]));
  const now = new Date();

  await db.batch([
    unshare("folder", folderIds),
    unshare(
      "document",
      living.map((entry) => entry.id),
    ),
    ...living.map((entry) =>
      db
        .update(document)
        .set({ deletedAt: now, deletedFrom: pathOf.get(entry.folderId ?? "") ?? null })
        .where(eq(document.id, entry.id)),
    ),
    // Subfolders go with it (cascade); documents already in the trash keep their own path.
    db.delete(folder).where(eq(folder.id, id)),
  ]);
}

export type TrashedDocument = {
  id: string;
  title: string;
  deletedAt: Date;
  deletedFrom: string | null;
};

/** What is in the trash, newest first. Anything older than `TRASH_DAYS` is removed on the way. */
export async function trash(): Promise<TrashedDocument[]> {
  await emptyOld();
  const rows = await db
    .select({
      id: document.id,
      title: document.title,
      deletedAt: document.deletedAt,
      deletedFrom: document.deletedFrom,
    })
    .from(document)
    .where(isNotNull(document.deletedAt))
    .orderBy(desc(document.deletedAt))
    .all();
  return rows.flatMap(({ deletedAt, ...row }) => (deletedAt ? [{ ...row, deletedAt }] : []));
}

async function trashed(id: string) {
  const found = await db
    .select({ folderId: document.folderId, deletedFrom: document.deletedFrom })
    .from(document)
    .where(and(eq(document.id, id), isNotNull(document.deletedAt)))
    .get();
  if (!found) throw new EvergardenError("not_found", `No document with id "${id}" in the trash.`);
  return found;
}

/** Puts a document back where it was, recreating its folders when they were deleted too. */
export async function restoreDocument(id: string): Promise<void> {
  const { folderId, deletedFrom } = await trashed(id);
  const target = folderId ?? (deletedFrom ? await folderAt(deletedFrom) : null);
  await db
    .update(document)
    .set({
      folderId: target,
      position: await firstDocumentPosition(target),
      deletedAt: null,
      deletedFrom: null,
    })
    .where(eq(document.id, id));
}

/** Deletes a document from the trash for good, with its versions and comments. */
export async function destroyDocument(id: string): Promise<void> {
  await trashed(id);
  await destroy([id]);
}

async function emptyOld() {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000);
  const old = await db
    .select({ id: document.id })
    .from(document)
    .where(lt(document.deletedAt, cutoff))
    .all();
  if (old.length > 0) await destroy(old.map((entry) => entry.id));
}

function destroy(ids: string[]) {
  return db.batch([unindex(ids), db.delete(document).where(inArray(document.id, ids))]);
}
