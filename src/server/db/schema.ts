import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth-schema";

export * from "./auth-schema";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export type AuthorKind = "agent" | "user";
export type ThreadStatus = "open" | "resolved" | "outdated";
export type Verdict = "approve" | "comment" | "request_changes";
export type SharePermission = "read" | "comment";
export type ShareTargetKind = "document" | "folder";

/** Where a thread points in the markdown source of its revision. */
export type Anchor = {
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
};

export const document = sqliteTable(
  "document",
  {
    id: text("id").primaryKey(),
    path: text("path").notNull(),
    title: text("title").notNull(),
    headRevision: integer("head_revision").notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("document_path_idx").on(table.path),
    index("document_updated_idx").on(table.updatedAt),
  ],
);

export const revision = sqliteTable(
  "revision",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    sha256: text("sha256").notNull(),
    message: text("message").notNull(),
    authorKind: text("author_kind").$type<AuthorKind>().notNull(),
    authorId: text("author_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("revision_document_number_idx").on(table.documentId, table.number)],
);

export const review = sqliteTable(
  "review",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revision.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verdict: text("verdict").$type<Verdict>(),
    body: text("body"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("review_document_idx").on(table.documentId),
    index("review_pending_idx").on(table.submittedAt, table.consumedAt),
  ],
);

export const thread = sqliteTable(
  "thread",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revision.id, { onDelete: "cascade" }),
    reviewId: text("review_id").references(() => review.id, { onDelete: "set null" }),
    anchor: text("anchor", { mode: "json" }).$type<Anchor>().notNull(),
    status: text("status").$type<ThreadStatus>().notNull().default("open"),
    suggestion: text("suggestion"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("thread_document_idx").on(table.documentId, table.status)],
);

export const comment = sqliteTable(
  "comment",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => thread.id, { onDelete: "cascade" }),
    authorKind: text("author_kind").$type<AuthorKind>().notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("comment_thread_idx").on(table.threadId)],
);

export const share = sqliteTable(
  "share",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    targetKind: text("target_kind").$type<ShareTargetKind>().notNull(),
    target: text("target").notNull(),
    revisionId: text("revision_id").references(() => revision.id, { onDelete: "cascade" }),
    permission: text("permission").$type<SharePermission>().notNull(),
    openCount: integer("open_count").notNull().default(0),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [uniqueIndex("share_token_idx").on(table.tokenHash)],
);

export const shareMember = sqliteTable(
  "share_member",
  {
    shareId: text("share_id")
      .notNull()
      .references(() => share.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.shareId, table.userId] })],
);

export const readMark = sqliteTable(
  "read_mark",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.documentId] })],
);
