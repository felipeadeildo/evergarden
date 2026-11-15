import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { quote, relocate } from "#/anchor";
import { newId } from "#/lib/id";
import { db } from "#/server/db";
import {
  type Anchor,
  type AuthorKind,
  type CommentStatus,
  comment,
  document,
  reply,
  version,
} from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";
import { type Author, read, update } from "#/server/library";

const MAX_BODY = 10_000;

export type Person = { kind: AuthorKind; name: string };

export type Reply = { id: string; body: string; author: Person; createdAt: Date };

export type Thread = {
  id: string;
  status: CommentStatus;
  anchor: Anchor;
  version: number;
  body: string;
  suggestion: string | null;
  author: Person;
  createdAt: Date;
  replies: Reply[];
};

export type NewComment = {
  version: number;
  kind: "text" | "block";
  start: number;
  end: number;
  body: string;
  suggestion?: string;
};

/** Every thread of a document, open ones first in the order they appear in the text. */
export async function threads(documentId: string): Promise<Thread[]> {
  const rows = await db
    .select({ comment, versionNumber: version.number })
    .from(comment)
    .innerJoin(version, eq(version.id, comment.versionId))
    .where(eq(comment.documentId, documentId))
    .all();
  const replies = await repliesOf(rows.map((row) => row.comment.id));
  const order: Record<CommentStatus, number> = { open: 0, detached: 1, resolved: 2 };
  return rows
    .map(({ comment: row, versionNumber }) => ({
      id: row.id,
      status: row.status,
      anchor: row.anchor,
      version: versionNumber,
      body: row.body,
      suggestion: row.suggestion,
      author: { kind: row.authorKind, name: row.authorName },
      createdAt: row.createdAt,
      replies: replies.get(row.id) ?? [],
    }))
    .toSorted((a, b) => order[a.status] - order[b.status] || a.anchor.start - b.anchor.start);
}

/** Comments on a range of the current version, as the page selected it. */
export async function addComment(
  documentId: string,
  input: NewComment,
  author: Author,
): Promise<string> {
  const current = await read(documentId);
  if (current.version.number !== input.version) {
    throw new EvergardenError(
      "conflict",
      `This document changed to version ${current.version.number}. Reload it to comment.`,
    );
  }
  if (input.start < 0 || input.end <= input.start || input.end > current.source.length) {
    throw new EvergardenError("invalid", "The comment points outside the document.");
  }
  return insert(documentId, current.version.id, {
    anchor: { kind: input.kind, ...quote(current.source, input.start, input.end) },
    body: input.body,
    suggestion: input.suggestion,
    author,
  });
}

/** Comments on the passage of the current version that matches `passage` exactly once. */
export async function commentOn(
  documentId: string,
  input: { passage: string; body: string },
  author: Author,
): Promise<string> {
  const current = await read(documentId);
  const first = current.source.indexOf(input.passage);
  if (!input.passage || first === -1) {
    throw new EvergardenError("invalid", "The passage is not in the current version.");
  }
  if (current.source.indexOf(input.passage, first + 1) !== -1) {
    throw new EvergardenError(
      "invalid",
      "The passage appears more than once. Quote more of it so it matches one place.",
    );
  }
  const end = first + input.passage.length;
  return insert(documentId, current.version.id, {
    anchor: { kind: "text", ...quote(current.source, first, end) },
    body: input.body,
    author,
  });
}

export async function addReply(commentId: string, body: string, author: Author): Promise<string> {
  await getComment(commentId);
  const id = newId();
  await db.insert(reply).values({ id, commentId, body: checkBody(body), ...authorColumns(author) });
  return id;
}

/** Closes a thread. A note is posted as its last reply. */
export async function resolve(commentId: string, author: Author, note?: string): Promise<void> {
  await getComment(commentId);
  if (note) await addReply(commentId, note, author);
  await db
    .update(comment)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(comment.id, commentId));
}

/** Opens a resolved thread again, where its passage still is. */
export async function reopen(commentId: string): Promise<void> {
  const found = await getComment(commentId);
  const current = await read(found.documentId);
  const moved = relocate(found.anchor, current.source);
  await db
    .update(comment)
    .set(
      moved
        ? {
            status: "open",
            resolvedAt: null,
            versionId: current.version.id,
            anchor: { ...found.anchor, ...moved },
          }
        : { status: "detached", resolvedAt: null },
    )
    .where(eq(comment.id, commentId));
}

/** Applies a suggestion as a new version and resolves its thread. */
export async function acceptSuggestion(commentId: string, author: Author): Promise<number> {
  const found = await getComment(commentId);
  if (found.suggestion === null) {
    throw new EvergardenError("invalid", "This comment has no suggestion to accept.");
  }
  if (found.status !== "open") {
    throw new EvergardenError("conflict", "Only an open suggestion can be accepted.");
  }
  const current = await read(found.documentId);
  const { start, end, exact } = found.anchor;
  if (current.source.slice(start, end) !== exact) {
    throw new EvergardenError("conflict", "The suggested passage changed. Read it again.");
  }
  const content = current.source.slice(0, start) + found.suggestion + current.source.slice(end);
  const updated = await update(
    found.documentId,
    { content, baseVersion: current.version.number },
    author,
  );
  await resolve(commentId, author);
  return updated.version;
}

/**
 * Open comments as markdown for an agent: one document, or every document with the ones the
 * agent has not seen first. Returning them marks them seen.
 */
export async function openComments(documentId?: string): Promise<string> {
  const rows = await db
    .select({
      comment,
      title: document.title,
      currentVersion: document.currentVersion,
    })
    .from(comment)
    .innerJoin(document, eq(document.id, comment.documentId))
    .where(
      and(
        or(eq(comment.status, "open"), eq(comment.status, "detached")),
        isNull(document.deletedAt),
        documentId ? eq(comment.documentId, documentId) : undefined,
      ),
    )
    .orderBy(desc(document.updatedAt), asc(comment.createdAt))
    .all();
  if (rows.length === 0) return documentId ? "No open comments." : "No open comments anywhere.";

  const replies = await repliesOf(rows.map((row) => row.comment.id));
  const unseen = (row: (typeof rows)[number]) =>
    row.comment.agentSeenAt === null ||
    (replies.get(row.comment.id) ?? []).some(
      (item) => item.author.kind === "user" && item.createdAt > row.comment.agentSeenAt!,
    );
  const ordered = documentId
    ? rows
    : rows.toSorted((a, b) => Number(unseen(b)) - Number(unseen(a)));

  const sections = new Map<string, string[]>();
  for (const row of ordered) {
    const heading = `## ${row.title} (${row.comment.documentId}), version ${row.currentVersion}`;
    const lines = sections.get(heading) ?? [];
    lines.push(describe(row.comment, replies.get(row.comment.id) ?? [], unseen(row)));
    sections.set(heading, lines);
  }
  await db
    .update(comment)
    .set({ agentSeenAt: new Date() })
    .where(
      inArray(
        comment.id,
        rows.map((row) => row.comment.id),
      ),
    );
  return [...sections].map(([heading, lines]) => [heading, ...lines].join("\n\n")).join("\n\n");
}

function describe(row: typeof comment.$inferSelect, replies: Reply[], unseen: boolean): string {
  const state = [row.status, unseen ? "new" : null].filter(Boolean).join(", ");
  const lines = [`### ${row.id} on ${place(row.anchor)}, ${state}`];
  if (row.status === "detached") {
    lines.push("The passage was rewritten after this comment. It quoted:");
  }
  if (row.anchor.kind === "text") {
    lines.push(`> ${row.anchor.exact.replaceAll("\n", "\n> ")}`);
    lines.push(
      `Context: …${oneLine(row.anchor.prefix)}>>>${oneLine(row.anchor.exact)}<<<${oneLine(row.anchor.suffix)}…`,
    );
  }
  if (row.suggestion !== null) {
    lines.push("Suggested replacement:", "```", row.suggestion, "```");
  }
  lines.push(`- ${row.authorName}: ${row.body}`);
  for (const item of replies) lines.push(`- ${item.author.name}: ${item.body}`);
  return lines.join("\n");
}

function place(anchor: Anchor): string {
  if (anchor.kind === "text") return "text";
  const head = anchor.exact.trimStart();
  if (head.startsWith("|")) return "a table";
  if (head.startsWith("```mermaid")) return "a diagram";
  if (head.startsWith("```")) return "a code block";
  if (head.startsWith("> [!")) return "a callout";
  return "a block";
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ");
}

async function insert(
  documentId: string,
  versionId: string,
  input: { anchor: Anchor; body: string; suggestion?: string; author: Author },
): Promise<string> {
  const id = newId();
  await db.insert(comment).values({
    id,
    documentId,
    versionId,
    anchor: input.anchor,
    body: checkBody(input.body),
    suggestion: input.suggestion ?? null,
    ...authorColumns(input.author),
    // The agent knows about its own comments already.
    agentSeenAt: input.author.kind === "agent" ? new Date() : null,
  });
  return id;
}

async function getComment(id: string) {
  const found = await db
    .select()
    .from(comment)
    .innerJoin(document, eq(document.id, comment.documentId))
    .where(and(eq(comment.id, id), isNull(document.deletedAt)))
    .get();
  if (!found) throw new EvergardenError("not_found", `No comment with id "${id}".`);
  return found.comment;
}

async function repliesOf(commentIds: string[]): Promise<Map<string, Reply[]>> {
  const byComment = new Map<string, Reply[]>();
  if (commentIds.length === 0) return byComment;
  const rows = await db
    .select()
    .from(reply)
    .where(inArray(reply.commentId, commentIds))
    .orderBy(asc(reply.createdAt))
    .all();
  for (const row of rows) {
    const list = byComment.get(row.commentId) ?? [];
    list.push({
      id: row.id,
      body: row.body,
      author: { kind: row.authorKind, name: row.authorName },
      createdAt: row.createdAt,
    });
    byComment.set(row.commentId, list);
  }
  return byComment;
}

function authorColumns(author: Author) {
  return { authorKind: author.kind, authorId: author.id, authorName: author.name };
}

function checkBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) throw new EvergardenError("invalid", "A comment needs some text.");
  if (trimmed.length > MAX_BODY) {
    throw new EvergardenError("invalid", `Comments are at most ${MAX_BODY} characters.`);
  }
  return trimmed;
}
