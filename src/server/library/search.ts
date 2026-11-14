import { eq, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { db } from "#/server/db";

// The FTS5 table from migrations/0001_search.sql. Declared here, outside the schema file, so
// drizzle-kit does not try to create it as a plain table.
const searchIndex = sqliteTable("search", {
  documentId: text("document_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
});

export type SearchHit = { id: string; title: string; excerpt: string };

/** Statements that replace a document's row in the index, for use inside a batch. FTS5 has no upsert. */
export function indexStatements(id: string, title: string, body: string) {
  return [
    db.delete(searchIndex).where(eq(searchIndex.documentId, id)),
    db.insert(searchIndex).values({ documentId: id, title, body }),
  ] as const;
}

/**
 * Every word must match, each as a prefix, so "nat gate" finds "NAT gateway".
 * Quoting each word keeps FTS5 operators in the query from being interpreted.
 */
function toMatchExpression(query: string): string | null {
  const words = query.match(/[\p{L}\p{N}_]+/gu);
  if (!words) return null;
  return words.map((word) => `"${word}"*`).join(" ");
}

/** Title matches rank first: a title hit counts ten times a body hit. */
export async function search(query: string, limit = 20): Promise<SearchHit[]> {
  const match = toMatchExpression(query);
  if (!match) return [];
  return db.all<SearchHit>(sql`
    select
      search.document_id as id,
      search.title as title,
      snippet(search, 2, '«', '»', '…', 12) as excerpt
    from search
    join document on document.id = search.document_id and document.deleted_at is null
    where search match ${match}
    order by bm25(search, 0, 10, 1)
    limit ${limit}
  `);
}
