import { and, eq } from "drizzle-orm";

import { db } from "#/server/db";
import { comment, reply, user, version } from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

/** Renames a person, and every comment, reply and version they signed with it. */
export async function rename(userId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) {
    throw new EvergardenError("invalid", "A name has 1 to 60 characters.");
  }
  const signed = { authorName: trimmed };
  await db.batch([
    db.update(user).set({ name: trimmed, updatedAt: new Date() }).where(eq(user.id, userId)),
    db
      .update(comment)
      .set(signed)
      .where(and(eq(comment.authorKind, "user"), eq(comment.authorId, userId))),
    db
      .update(reply)
      .set(signed)
      .where(and(eq(reply.authorKind, "user"), eq(reply.authorId, userId))),
    db
      .update(version)
      .set(signed)
      .where(and(eq(version.authorKind, "user"), eq(version.authorId, userId))),
  ]);
  return trimmed;
}
