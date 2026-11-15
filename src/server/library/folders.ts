import { and, asc, desc, eq, isNull, type SQL, sql } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";

import { newId } from "#/lib/id";
import { db } from "#/server/db";
import { document, folder } from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

const MAX_NAME_LENGTH = 100;

export function parseFolderPath(path: string): string[] {
  const names = path
    .split("/")
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.some((name) => name.length > MAX_NAME_LENGTH)) {
    throw new EvergardenError("invalid", `Folder names are at most ${MAX_NAME_LENGTH} characters.`);
  }
  return names;
}

/**
 * The same repository written different ways gives one key:
 * `git@github.com:Ranqia/ada.git` and `https://github.com/ranqia/ada/` both give `github.com/ranqia/ada`.
 */
export function normaliseRepo(repo: string): string {
  const key = repo
    .trim()
    .toLowerCase()
    .replace(/^[a-z+]+:\/\//, "")
    .replace(/^[^@/]+@([^:/]+):/, "$1/")
    .replace(/^[^@/]+@/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  if (!/^[\w.-]+(\/[\w.-]+)+$/.test(key)) {
    throw new EvergardenError("invalid", `"${repo}" is not a repository URL.`);
  }
  return key;
}

function parentIs(parentId: string | null) {
  return parentId ? eq(folder.parentId, parentId) : isNull(folder.parentId);
}

export async function lastFolderPosition(parentId: string | null): Promise<string | null> {
  const last = await db
    .select({ position: folder.position })
    .from(folder)
    .where(parentIs(parentId))
    .orderBy(desc(folder.position))
    .get();
  return last?.position ?? null;
}

export async function childFolder(
  parentId: string | null,
  name: string,
): Promise<string | undefined> {
  const found = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(parentIs(parentId), eq(folder.name, name)))
    .get();
  return found?.id;
}

export async function findFolder(names: string[]): Promise<string | null> {
  let parentId: string | null = null;
  for (const name of names) {
    const found = await childFolder(parentId, name);
    if (!found) return null;
    parentId = found;
  }
  return parentId;
}

/** Missing parts are created at the end of their parents. */
export async function ensureFolder(names: string[], repo?: string): Promise<string | null> {
  let parentId: string | null = null;
  for (const [index, name] of names.entries()) {
    const found = await childFolder(parentId, name);
    if (found) {
      parentId = found;
      continue;
    }
    const id = newId();
    const isLast = index === names.length - 1;
    await db.insert(folder).values({
      id,
      parentId,
      name,
      position: generateKeyBetween(await lastFolderPosition(parentId), null),
      repo: isLast ? repo : undefined,
    });
    parentId = id;
  }
  return parentId;
}

export async function folderForRepo(repo: string): Promise<string | null> {
  const linked = await db.select({ id: folder.id }).from(folder).where(eq(folder.repo, repo)).get();
  return linked?.id ?? null;
}

/**
 * Where `publish` files a document. A folder linked to the repository wins; otherwise the named
 * folder, linked to the repository when it has no link yet; otherwise a new root folder named
 * after the repository.
 */
export async function resolveTarget(path?: string, repo?: string): Promise<string | null> {
  const repoKey = repo ? normaliseRepo(repo) : undefined;
  if (repoKey) {
    const linked = await folderForRepo(repoKey);
    if (linked) return linked;
  }

  const names = path ? parseFolderPath(path) : [];
  if (names.length === 0) {
    return repoKey ? ensureFolder([repoKey.split("/").at(-1)!], repoKey) : null;
  }

  const id = await ensureFolder(names, repoKey);
  if (repoKey && id) {
    await db
      .update(folder)
      .set({ repo: repoKey })
      .where(and(eq(folder.id, id), isNull(folder.repo)));
  }
  return id;
}

export type FolderStep = { id: string; name: string };

/** The folders from the top of the library down to `folderId`, in one query. */
export async function folderPath(folderId: string | null): Promise<FolderStep[]> {
  return folderId ? pathFrom(sql`${folderId}`) : [];
}

/** The folders down to the one a document sits in, without looking the document up first. */
export function documentFolderPath(documentId: string): Promise<FolderStep[]> {
  return pathFrom(sql`(select folder_id from document where id = ${documentId})`);
}

function pathFrom(start: SQL): Promise<FolderStep[]> {
  return db.all<FolderStep>(sql`
    with recursive up(id, name, parent_id, depth) as (
      select id, name, parent_id, 0 from folder where id = ${start}
      union all
      select folder.id, folder.name, folder.parent_id, up.depth + 1
      from folder join up on folder.id = up.parent_id
    )
    select id, name from up order by depth desc
  `);
}

/** New documents go to the top of their folder. */
export async function firstDocumentPosition(folderId: string | null): Promise<string> {
  const first = await db
    .select({ position: document.position })
    .from(document)
    .where(folderId ? eq(document.folderId, folderId) : isNull(document.folderId))
    .orderBy(asc(document.position))
    .get();
  return generateKeyBetween(null, first?.position ?? null);
}
