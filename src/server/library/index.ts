import { and, asc, count, desc, eq, isNull, lt, or, type SQL, sql } from "drizzle-orm";

import { newId } from "#/lib/id";
import { render } from "#/render";
import { db } from "#/server/db";
import { type AuthorKind, document, folder, readMark, version } from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

import { sha256, source, store } from "./content";
import {
  findFolder,
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
};

export type FolderEntry = {
  id: string;
  parentId: string | null;
  name: string;
  position: string;
  repo: string | null;
};

/** A folder as the library shows it before it is opened: how many things it holds. */
export type FolderSummary = FolderEntry & { items: number };

/** What sits directly inside a folder: its folders, and one page of its documents. */
export type FolderPage = { folders: FolderSummary[]; documents: DocumentEntry[]; more: number };

/** A document with the path of the folder it sits in, such as "reports/2026". */
export type PlacedDocument = DocumentEntry & { place: string | null };

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
};

const currentVersion = and(
  eq(version.documentId, document.id),
  eq(version.number, document.currentVersion),
);

/** Documents that are not deleted, with their current version's author. */
function liveDocuments(where?: SQL) {
  return db
    .select(documentEntry)
    .from(document)
    .innerJoin(version, currentVersion)
    .where(and(isNull(document.deletedAt), where));
}

function checkContent(content: string): string {
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
 * Creates a document. Publishing content that is already the current version of a document
 * returns that document instead, so an agent retrying after a timeout creates no duplicate.
 * `title` is used only when the content has no frontmatter title or leading heading.
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

/**
 * Saves a new version. Content equal to the current version saves nothing. With `baseVersion`,
 * the call fails when someone else saved a version since, instead of overwriting it.
 */
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
  try {
    await db.batch([
      db.insert(version).values(versionRow(id, number, sha, author)),
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
  return { id, version: number, changed: true };
}

export type Read = {
  document: DocumentEntry;
  version: VersionEntry & { sha256: string };
  source: string;
};

export async function read(id: string, versionNumber?: number): Promise<Read> {
  const found = await getDocument(id);
  const row = await versionByNumber(id, versionNumber ?? found.version);
  return {
    document: found,
    version: {
      number: row.number,
      authorKind: row.authorKind,
      authorName: row.authorName,
      createdAt: row.createdAt,
      sha256: row.sha256,
    },
    source: await source(row.sha256),
  };
}

export async function versions(id: string): Promise<VersionEntry[]> {
  await getDocument(id);
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

/** Every folder and live document, or only the subtree of a folder path or linked repository. */
export async function list(filter: { folder?: string; repo?: string } = {}): Promise<Library> {
  const folders = await db.select(folderColumns).from(folder).all();
  const documents = await liveDocuments().all();

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

const PAGE_SIZE = 50;

/**
 * The folders and documents directly inside a folder, or at the top of the library for `null`.
 * Documents come `PAGE_SIZE` at a time from `offset`; `more` counts the ones left after this page.
 * Folders come with the first page only.
 */
export async function folderContents(folderId: string | null, offset = 0): Promise<FolderPage> {
  const inFolder = folderId ? eq(document.folderId, folderId) : isNull(document.folderId);
  // Written out: inside a subquery, Drizzle would print folder.id unqualified, as the inner id.
  const items = sql<number>`(
    (select count(*) from folder as child where child.parent_id = "folder"."id")
    + (select count(*) from document as inside
       where inside.folder_id = "folder"."id" and inside.deleted_at is null)
  )`;

  const [folders, documents, total] = await Promise.all([
    offset > 0
      ? []
      : db
          .select({ ...folderColumns, items })
          .from(folder)
          .where(folderId ? eq(folder.parentId, folderId) : isNull(folder.parentId))
          .orderBy(asc(folder.position))
          .all(),
    liveDocuments(inFolder).orderBy(asc(document.position)).limit(PAGE_SIZE).offset(offset).all(),
    db
      .select({ count: count() })
      .from(document)
      .where(and(inFolder, isNull(document.deletedAt)))
      .get(),
  ]);
  return { folders, documents, more: Math.max(0, (total?.count ?? 0) - offset - documents.length) };
}

/** Adds the folder path of each document, reading the folder table once. */
export async function withPlaces(entries: DocumentEntry[]): Promise<PlacedDocument[]> {
  if (entries.length === 0) return [];
  const folders = new Map(
    (await db.select(folderColumns).from(folder).all()).map((f) => [f.id, f]),
  );
  return entries.map((entry) => {
    const names: string[] = [];
    for (let id = entry.folderId; id; id = folders.get(id)?.parentId ?? null) {
      const name = folders.get(id)?.name;
      if (name === undefined) break;
      names.unshift(name);
    }
    return { ...entry, place: names.length ? names.join("/") : null };
  });
}

/** Records that `userId` read `versionNumber`; "New for you" compares against it. */
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

/** Documents updated since `userId` last read them, newest first. Never-read documents count. */
export async function newFor(userId: string, limit = 20): Promise<DocumentEntry[]> {
  return db
    .select(documentEntry)
    .from(document)
    .innerJoin(version, currentVersion)
    .leftJoin(readMark, and(eq(readMark.documentId, document.id), eq(readMark.userId, userId)))
    .where(
      and(
        isNull(document.deletedAt),
        or(isNull(readMark.versionNumber), lt(readMark.versionNumber, document.currentVersion)),
      ),
    )
    .orderBy(desc(document.updatedAt))
    .limit(limit)
    .all();
}

const folderColumns = {
  id: folder.id,
  parentId: folder.parentId,
  name: folder.name,
  position: folder.position,
  repo: folder.repo,
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
