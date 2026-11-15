import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { apikey, oauthClient, user } from "./auth-schema";

export * from "./auth-schema";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export type AuthorKind = "agent" | "user";
export type CommentStatus = "open" | "resolved" | "detached";
export type SharePermission = "read" | "comment";
export type ShareTargetKind = "document" | "folder";

type Quote = { start: number; end: number; exact: string; prefix: string; suffix: string };

/** Where a comment points in the markdown source of its version. */
export type Anchor =
  | ({ kind: "text" } & Quote)
  | ({ kind: "block" } & Quote)
  | ({ kind: "point"; x: number; y: number } & Quote);

/**
 * Document text by SHA-256, shared by every version with the same text. `rendered` caches the
 * gzipped tree from renderer `rendererVersion`; a newer renderer ignores it and writes its own.
 */
export const content = sqliteTable("content", {
  sha256: text("sha256").primaryKey(),
  markdown: text("markdown").notNull(),
  rendered: blob("rendered", { mode: "buffer" }),
  rendererVersion: integer("renderer_version"),
});

export const folder = sqliteTable(
  "folder",
  {
    id: text("id").primaryKey(),
    parentId: text("parent_id").references((): AnySQLiteColumn => folder.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    position: text("position").notNull(),
    repo: text("repo"),
    createdAt: createdAt(),
  },
  (table) => [
    index("folder_parent_idx").on(table.parentId, table.position),
    uniqueIndex("folder_repo_idx").on(table.repo),
  ],
);

export const document = sqliteTable(
  "document",
  {
    id: text("id").primaryKey(),
    folderId: text("folder_id").references(() => folder.id, { onDelete: "set null" }),
    position: text("position").notNull(),
    title: text("title").notNull(),
    currentVersion: integer("current_version").notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("document_folder_idx").on(table.folderId, table.position),
    index("document_updated_idx").on(table.updatedAt),
  ],
);

export const version = sqliteTable(
  "version",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    sha256: text("sha256").notNull(),
    authorKind: text("author_kind").$type<AuthorKind>().notNull(),
    authorId: text("author_id").notNull(),
    // Kept on the row so a deleted API key or account still shows who wrote it.
    authorName: text("author_name").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("version_document_number_idx").on(table.documentId, table.number)],
);

export const comment = sqliteTable(
  "comment",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => version.id, { onDelete: "cascade" }),
    anchor: text("anchor", { mode: "json" }).$type<Anchor>().notNull(),
    body: text("body").notNull(),
    suggestion: text("suggestion"),
    status: text("status").$type<CommentStatus>().notNull().default("open"),
    authorKind: text("author_kind").$type<AuthorKind>().notNull(),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    agentSeenAt: integer("agent_seen_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("comment_document_idx").on(table.documentId, table.status)],
);

export const reply = sqliteTable(
  "reply",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id")
      .notNull()
      .references(() => comment.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorKind: text("author_kind").$type<AuthorKind>().notNull(),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    createdAt: createdAt(),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("reply_comment_idx").on(table.commentId)],
);

/**
 * Who besides the owner may open a document or a folder, by its usual address. A folder's
 * setting covers everything inside it; the most open setting that applies wins.
 */
export const sharing = sqliteTable(
  "sharing",
  {
    targetKind: text("target_kind").$type<ShareTargetKind>().notNull(),
    targetId: text("target_id").notNull(),
    permission: text("permission").$type<SharePermission>().notNull(),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  },
  (table) => [primaryKey({ columns: [table.targetKind, table.targetId] })],
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
    versionNumber: integer("version_number").notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.documentId] })],
);

/**
 * Every agent that may use the library, however it connected: over OAuth (`clientId`), when the
 * owner approved it on /connect, or with an API key (`apiKeyId`). Its name signs what it writes.
 * Deleting the row locks the agent out, even with an access token that has not expired.
 */
export const agent = sqliteTable(
  "agent",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    clientId: text("client_id").references(() => oauthClient.clientId, { onDelete: "cascade" }),
    apiKeyId: text("api_key_id").references(() => apikey.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("agent_client_idx").on(table.userId, table.clientId),
    uniqueIndex("agent_api_key_idx").on(table.apiKeyId),
  ],
);
