import { type AnyColumn, and, asc, count, desc, eq, isNull, type SQL, sql } from "drizzle-orm";

import { newId } from "#/lib/id";
import { FOLDER_PAGE_SIZE } from "#/lib/text";
import { type Rendered, render } from "#/render";
import { relocateComments } from "#/server/comments/relocate";
import { db } from "#/server/db";
import {
  type AuthorKind,
  type ShareAudience,
  content as contentTable,
  document,
  folder,
  readMark,
  version,
} from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

import { cachedRender, sha256, store } from "./content";
import {
  documentFolderPath,
  findFolder,
  folderPath,
  type FolderStep,
  firstDocumentPosition,
  normaliseRepo,
  parseFolderPath,
  resolveTarget,
} from "./folders";
import { indexStatements } from "./search";

export { rendered } from "./content";
export { folderPath, type FolderStep } from "./folders";
export { search, type SearchHit } from "./search";

/** Documents are rendered inside a request, so their size is capped. */
export const MAX_CONTENT_BYTES = 512 * 1024;

export type Author = { kind: AuthorKind; id: string; name: string };

export type DocumentEntry = {
  id: string;
  folderId: string | null;
  position: string;
  title: string;
  version: number;
  updatedAt: Date;
  updatedBy: string;
  /** Who besides the owner may open it, by its own setting; null when it has none. */
  shared: ShareAudience | null;
};

export type FolderEntry = {
  id: string;
  parentId: string | null;
  name: string;
  position: string;
  repo: string | null;
  shared: ShareAudience | null;
};

/** The audience of a target's own sharing setting, while it has not expired. */
function sharedColumn(kind: "document" | "folder", id: AnyColumn) {
  return sql<ShareAudience | null>`(
    select audience from sharing
    where target_kind = ${kind} and target_id = ${id}
      and (expires_at is null or expires_at > unixepoch('subsecond') * 1000)
  )`;
}

export type FolderSummary = FolderEntry & { documents: number };

export type FolderPage = { folders: FolderSummary[]; documents: DocumentEntry[]; more: number };

export type VersionEntry = {
  number: number;
  authorKind: AuthorKind;
  authorName: string;
  createdAt: Date;
};

const documentEntry = {
  id: document.id,
  folderId: document.folderId,
  position: document.position,
  title: document.title,
  version: document.currentVersion,
  updatedAt: document.updatedAt,
  updatedBy: version.authorName,
  shared: sharedColumn("document", document.id),
};

const currentVersion = and(
  eq(version.documentId, document.id),
  eq(version.number, document.currentVersion),
);

function liveDocuments(where?: SQL) {
  return db
    .select(documentEntry)
    .from(document)
    .innerJoin(version, currentVersion)
    .where(and(isNull(document.deletedAt), where));
}

export function checkContent(content: string): string {
  if (!content.trim()) throw new EvergardenError("invalid", "The content is empty.");
  if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES) {
    throw new EvergardenError("invalid", `Documents are at most ${MAX_CONTENT_BYTES / 1024} KB.`);
  }
  return content;
}

export async function getDocument(id: string): Promise<DocumentEntry> {
  const found = await liveDocuments(eq(document.id, id)).get();
  if (!found) throw new EvergardenError("not_found", `No document with id "${id}".`);
  return found;
}

export type Published = { id: string; version: number; created: boolean };

/**
 * Publishing content that is already a document's current version returns that document,
 * so an agent retrying after a timeout creates no duplicate.
 */
export async function publish(
  input: { content: string; title?: string; folder?: string; repo?: string },
  author: Author,
): Promise<Published> {
  const content = checkContent(input.content);
  const sha = await sha256(content);

  const existing = await liveDocuments(eq(version.sha256, sha)).get();
  if (existing) return { id: existing.id, version: existing.version, created: false };

  const result = await render(content);
  const title = result.title || input.title?.trim() || firstWords(result.text);
  const folderId = await resolveTarget(input.folder, input.repo);
  const id = newId();

  await store(sha, content, result);
  await db.batch([
    db.insert(document).values({
      id,
      folderId,
      position: await firstDocumentPosition(folderId),
      title,
      currentVersion: 1,
      updatedAt: new Date(),
    }),
    db.insert(version).values(versionRow(id, 1, sha, author)),
    ...indexStatements(id, title, result.text),
  ]);
  return { id, version: 1, created: true };
}

export type Updated = { id: string; version: number; changed: boolean };

/** With `baseVersion`, fails when someone saved a version since, instead of overwriting it. */
export async function update(
  id: string,
  input: { content: string; baseVersion?: number },
  author: Author,
): Promise<Updated> {
  const content = checkContent(input.content);
  const current = await getDocument(id);
  if (input.baseVersion !== undefined && input.baseVersion !== current.version) {
    throw conflict(id, current.version);
  }

  const sha = await sha256(content);
  const currentRow = await versionByNumber(id, current.version);
  if (currentRow.sha256 === sha) return { id, version: current.version, changed: false };

  const result = await render(content);
  const title = result.title ?? current.title;
  const number = current.version + 1;

  await store(sha, content, result);
  const row = versionRow(id, number, sha, author);
  try {
    await db.batch([
      db.insert(version).values(row),
      db
        .update(document)
        .set({ currentVersion: number, title, updatedAt: new Date() })
        .where(and(eq(document.id, id), eq(document.currentVersion, current.version))),
      ...indexStatements(id, title, result.text),
    ]);
  } catch (error) {
    // Two updates raced: the unique (document, number) index rejected the second.
    if (String(error).includes("UNIQUE constraint failed")) throw conflict(id, number);
    throw error;
  }
  await relocateComments(id, row.id, content);
  return { id, version: number, changed: true };
}

export type Read = {
  document: DocumentEntry;
  version: VersionEntry & { id: string; sha256: string };
  source: string;
};

export async function read(id: string, versionNumber?: number): Promise<Read> {
  const [found, shown] = await Promise.all([getDocument(id), shownVersion(id, versionNumber)]);
  return { document: found, version: shown.version, source: shown.markdown };
}

export type DocumentPage = Read & {
  versions: VersionEntry[];
  folder: FolderStep[];
  body: Rendered;
};

/**
 * Everything the document page shows. The queries are independent, so they run at once and the
 * page costs one round trip to D1 instead of one per query.
 */
export async function documentPage(id: string, versionNumber?: number): Promise<DocumentPage> {
  const [found, shown, history, path] = await Promise.all([
    getDocument(id),
    shownVersion(id, versionNumber),
    versions(id),
    documentFolderPath(id),
  ]);
  return {
    document: found,
    version: shown.version,
    source: shown.markdown,
    versions: history,
    folder: path,
    body: await cachedRender(shown.version.sha256, shown.markdown, shown.cache),
  };
}

/** A version with its text and cached rendering; the current one when `number` is not given. */
async function shownVersion(id: string, number?: number) {
  const row = await db
    .select({
      id: version.id,
      number: version.number,
      authorKind: version.authorKind,
      authorName: version.authorName,
      createdAt: version.createdAt,
      sha256: version.sha256,
      markdown: contentTable.markdown,
      rendered: contentTable.rendered,
      rendererVersion: contentTable.rendererVersion,
    })
    .from(version)
    .innerJoin(contentTable, eq(contentTable.sha256, version.sha256))
    .where(
      and(
        eq(version.documentId, id),
        eq(
          version.number,
          number ??
            sql`(select ${document.currentVersion} from ${document} where ${document.id} = ${id})`,
        ),
      ),
    )
    .get();
  if (!row) {
    throw new EvergardenError(
      "not_found",
      number ? `Document "${id}" has no version ${number}.` : `No document with id "${id}".`,
    );
  }
  const { markdown, rendered, rendererVersion, ...shown } = row;
  return { version: shown, markdown, cache: { rendered, rendererVersion } };
}

export async function versions(id: string): Promise<VersionEntry[]> {
  return db
    .select({
      number: version.number,
      authorKind: version.authorKind,
      authorName: version.authorName,
      createdAt: version.createdAt,
    })
    .from(version)
    .where(eq(version.documentId, id))
    .orderBy(desc(version.number))
    .all();
}

export type Library = { folders: FolderEntry[]; documents: DocumentEntry[] };

export async function list(filter: { folder?: string; repo?: string } = {}): Promise<Library> {
  const [folders, documents] = await Promise.all([
    db.select(folderColumns).from(folder).all(),
    liveDocuments().all(),
  ]);

  let rootId: string | null | undefined;
  if (filter.repo) {
    const repo = normaliseRepo(filter.repo);
    rootId = folders.find((entry) => entry.repo === repo)?.id ?? null;
  } else if (filter.folder) {
    rootId = await findFolder(parseFolderPath(filter.folder));
  }
  if (rootId === undefined) return { folders, documents };
  if (rootId === null) return { folders: [], documents: [] };

  const inside = new Set([rootId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const entry of folders) {
      if (entry.parentId && inside.has(entry.parentId) && !inside.has(entry.id)) {
        inside.add(entry.id);
        grew = true;
      }
    }
  }
  return {
    folders: folders.filter((entry) => inside.has(entry.id)),
    documents: documents.filter((entry) => entry.folderId && inside.has(entry.folderId)),
  };
}

/** Folders come with the first page only. */
export async function folderContents(folderId: string | null, offset = 0): Promise<FolderPage> {
  const inFolder = folderId ? eq(document.folderId, folderId) : isNull(document.folderId);
  const [folders, documents, total] = await Promise.all([
    offset > 0 ? [] : childFolders(folderId),
    liveDocuments(inFolder)
      .orderBy(asc(document.position))
      .limit(FOLDER_PAGE_SIZE)
      .offset(offset)
      .all(),
    db
      .select({ count: count() })
      .from(document)
      .where(and(inFolder, isNull(document.deletedAt)))
      .get(),
  ]);
  return { folders, documents, more: Math.max(0, (total?.count ?? 0) - offset - documents.length) };
}

async function childFolders(parentId: string | null): Promise<FolderSummary[]> {
  const [children, counts] = await Promise.all([
    db
      .select(folderColumns)
      .from(folder)
      .where(parentId ? eq(folder.parentId, parentId) : isNull(folder.parentId))
      .orderBy(asc(folder.position))
      .all(),
    countDocuments(parentId ? sql`parent_id = ${parentId}` : sql`parent_id is null`),
  ]);
  const byRoot = new Map(counts.map((row) => [row.root, row.documents]));
  return children.map((entry) => Object.assign(entry, { documents: byRoot.get(entry.id) ?? 0 }));
}

/** Documents in each folder that `roots` selects, counting those in its subfolders. */
function countDocuments(roots: SQL): Promise<Array<{ root: string; documents: number }>> {
  return db.all<{ root: string; documents: number }>(sql`
    with recursive tree(root, id) as (
      select id, id from folder where ${roots}
      union all
      select tree.root, folder.id from folder join tree on folder.parent_id = tree.id
    )
    select tree.root as root, count(document.id) as documents
    from tree left join document
      on document.folder_id = tree.id and document.deleted_at is null
    group by tree.root
  `);
}

export async function withPlaces<T extends DocumentEntry>(
  entries: T[],
): Promise<Array<T & { place: string | null }>> {
  if (entries.length === 0) return [];
  return placeIn(entries, await db.select(folderColumns).from(folder).all());
}

function placeIn<T extends DocumentEntry>(
  entries: T[],
  folderRows: FolderEntry[],
): Array<T & { place: string | null }> {
  const folders = new Map(folderRows.map((f) => [f.id, f]));
  return entries.map((entry) => {
    const names: string[] = [];
    for (let id = entry.folderId; id; id = folders.get(id)?.parentId ?? null) {
      const name = folders.get(id)?.name;
      if (name === undefined) break;
      names.unshift(name);
    }
    return Object.assign(entry, { place: names.length ? names.join("/") : null });
  });
}

export async function markRead(userId: string, documentId: string, versionNumber: number) {
  await db
    .insert(readMark)
    .values({ userId, documentId, versionNumber, readAt: new Date() })
    .onConflictDoUpdate({
      target: [readMark.userId, readMark.documentId],
      set: {
        versionNumber: sql`max(${readMark.versionNumber}, excluded.version_number)`,
        readAt: new Date(),
      },
    });
}

export type RecentDocument = DocumentEntry & { place: string | null; unread: boolean };

/** A document the reader never opened counts as unread. */
export async function recent(userId: string | null, limit = 10): Promise<RecentDocument[]> {
  const unread = sql<number>`${userId === null ? 0 : 1}
    and coalesce(${readMark.versionNumber}, 0) < ${document.currentVersion}`.mapWith(Boolean);
  const [rows, folders] = await Promise.all([
    db
      .select({ ...documentEntry, unread })
      .from(document)
      .innerJoin(version, currentVersion)
      .leftJoin(
        readMark,
        and(eq(readMark.documentId, document.id), eq(readMark.userId, userId ?? "")),
      )
      .where(isNull(document.deletedAt))
      .orderBy(desc(document.updatedAt))
      .limit(limit)
      .all(),
    db.select(folderColumns).from(folder).all(),
  ]);
  return placeIn(rows, folders);
}

export async function folderInfo(id: string): Promise<FolderSummary & { path: FolderStep[] }> {
  const [row, [counted], path] = await Promise.all([
    db.select(folderColumns).from(folder).where(eq(folder.id, id)).get(),
    countDocuments(sql`id = ${id}`),
    folderPath(id),
  ]);
  if (!row) throw new EvergardenError("not_found", "There is no folder with this id.");
  return Object.assign(row, { documents: counted?.documents ?? 0, path });
}

const folderColumns = {
  id: folder.id,
  parentId: folder.parentId,
  name: folder.name,
  position: folder.position,
  repo: folder.repo,
  shared: sharedColumn("folder", folder.id),
};

function versionRow(documentId: string, number: number, sha: string, author: Author) {
  return {
    id: newId(),
    documentId,
    number,
    sha256: sha,
    authorKind: author.kind,
    authorId: author.id,
    authorName: author.name,
  };
}

async function versionByNumber(documentId: string, number: number) {
  const row = await db
    .select()
    .from(version)
    .where(and(eq(version.documentId, documentId), eq(version.number, number)))
    .get();
  if (!row)
    throw new EvergardenError("not_found", `Document "${documentId}" has no version ${number}.`);
  return row;
}

function conflict(id: string, latest: number): EvergardenError {
  return new EvergardenError(
    "conflict",
    `Document "${id}" is at version ${latest}. Read it and apply your change again.`,
  );
}

function firstWords(text: string): string {
  const words = text.split(" ").slice(0, 8).join(" ");
  return words || "Untitled";
}
