import { and, eq } from "drizzle-orm";

import { relocate } from "#/anchor";
import { db } from "#/server/db";
import { comment } from "#/server/db/schema";

/**
 * Moves every open comment of a document onto its new version. A comment whose passage is gone
 * becomes detached and keeps pointing at the version it was written on.
 */
export async function relocateComments(
  documentId: string,
  versionId: string,
  source: string,
): Promise<void> {
  const open = await db
    .select({ id: comment.id, anchor: comment.anchor })
    .from(comment)
    .where(and(eq(comment.documentId, documentId), eq(comment.status, "open")))
    .all();
  const moves = open.map(({ id, anchor }) => {
    const moved = relocate(anchor, source);
    return moved
      ? db
          .update(comment)
          .set({ versionId, anchor: { ...anchor, ...moved } })
          .where(eq(comment.id, id))
      : db.update(comment).set({ status: "detached" }).where(eq(comment.id, id));
  });
  const [first, ...rest] = moves;
  if (first) await db.batch([first, ...rest]);
}
