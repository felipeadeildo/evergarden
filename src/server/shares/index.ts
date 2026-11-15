import { waitUntil } from "cloudflare:workers";
import { and, desc, eq, sql } from "drizzle-orm";

import { newId } from "#/lib/id";
import { db } from "#/server/db";
import {
  document,
  folder,
  share,
  shareMember,
  type SharePermission,
  type ShareTargetKind,
  user,
  version,
} from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";
import { sha256 } from "#/server/library/content";

/** A link that lets someone without an account read, or comment on, a document or a folder. */
export type Share = {
  id: string;
  targetKind: ShareTargetKind;
  targetId: string;
  /** The version a document link is pinned to; null follows the current one. */
  versionNumber: number | null;
  permission: SharePermission;
};

export type ShareEntry = Share & {
  title: string;
  opens: number;
  members: number;
  createdAt: Date;
  expiresAt: Date | null;
};

export type NewShare = {
  targetKind: ShareTargetKind;
  targetId: string;
  permission: SharePermission;
  /** Pins a document link to its current version. */
  pinned?: boolean;
  expiresInDays?: number | null;
};

const TOKEN_LENGTH = 24;

/** Creates a link. The token is returned once; only its hash is stored. */
export async function createShare(input: NewShare): Promise<{ id: string; token: string }> {
  const versionId = await targetVersion(input);
  const token = newId(TOKEN_LENGTH);
  const id = newId();
  const days = input.expiresInDays ?? null;
  await db.insert(share).values({
    id,
    tokenHash: await sha256(token),
    targetKind: input.targetKind,
    targetId: input.targetId,
    versionId,
    permission: input.permission,
    expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
  });
  return { id, token };
}

async function targetVersion(input: NewShare): Promise<string | null> {
  if (input.targetKind === "folder") {
    const found = await db
      .select({ id: folder.id })
      .from(folder)
      .where(eq(folder.id, input.targetId))
      .get();
    if (!found) throw new EvergardenError("not_found", "There is no folder with this id.");
    return null;
  }
  const found = await db
    .select({ versionId: version.id })
    .from(document)
    .innerJoin(
      version,
      and(eq(version.documentId, document.id), eq(version.number, document.currentVersion)),
    )
    .where(and(eq(document.id, input.targetId), sql`${document.deletedAt} is null`))
    .get();
  if (!found) throw new EvergardenError("not_found", `No document with id "${input.targetId}".`);
  return input.pinned ? found.versionId : null;
}

/**
 * The share behind a token, if it is still valid. Counting the open happens after the response.
 * Throws not_found for an unknown, revoked or expired link, so the page says the same for all.
 */
export async function openShare(token: string, count = false): Promise<Share> {
  const row = await db
    .select({
      id: share.id,
      targetKind: share.targetKind,
      targetId: share.targetId,
      versionNumber: version.number,
      permission: share.permission,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
    })
    .from(share)
    .leftJoin(version, eq(version.id, share.versionId))
    .where(eq(share.tokenHash, await sha256(token)))
    .get();
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt.getTime() < Date.now())) {
    throw new EvergardenError("not_found", "This link was revoked or has expired.");
  }
  if (count) {
    waitUntil(
      db
        .update(share)
        .set({ openCount: sql`${share.openCount} + 1` })
        .where(eq(share.id, row.id))
        .then(() => undefined),
    );
  }
  const { expiresAt: _expires, revokedAt: _revoked, ...found } = row;
  return found;
}

/** Whether a share lets its holder see `documentId`: the document itself, or one inside the folder. */
export async function shareCovers(found: Share, documentId: string): Promise<boolean> {
  if (found.targetKind === "document") return found.targetId === documentId;
  const rows = await db.all<{ id: string }>(sql`
    with recursive inside(id) as (
      select ${found.targetId}
      union all
      select folder.id from folder join inside on folder.parent_id = inside.id
    )
    select document.id from document
    where document.id = ${documentId} and document.deleted_at is null
      and document.folder_id in (select id from inside)
  `);
  return rows.length > 0;
}

/** Whether a folder sits in a folder share: the shared folder or one below it. */
export async function shareCoversFolder(found: Share, folderId: string): Promise<boolean> {
  if (found.targetKind !== "folder") return false;
  const rows = await db.all<{ id: string }>(sql`
    with recursive inside(id) as (
      select ${found.targetId}
      union all
      select folder.id from folder join inside on folder.parent_id = inside.id
    )
    select id from inside where id = ${folderId}
  `);
  return rows.length > 0;
}

/** Records that a signed-in guest came through a share, for the owner's list of people. */
export async function joinShare(shareId: string, userId: string): Promise<void> {
  await db.insert(shareMember).values({ shareId, userId }).onConflictDoNothing();
}

export async function listShares(): Promise<ShareEntry[]> {
  const rows = await db
    .select({
      id: share.id,
      targetKind: share.targetKind,
      targetId: share.targetId,
      versionNumber: version.number,
      permission: share.permission,
      opens: share.openCount,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      title: sql<string>`coalesce(
        (select title from document where id = ${share.targetId}),
        (select name from folder where id = ${share.targetId}),
        'Deleted'
      )`,
      members: sql<number>`(select count(*) from share_member where share_id = ${share.id})`,
    })
    .from(share)
    .leftJoin(version, eq(version.id, share.versionId))
    .where(sql`${share.revokedAt} is null`)
    .orderBy(desc(share.createdAt))
    .all();
  return rows;
}

export async function revokeShare(id: string): Promise<void> {
  await db.update(share).set({ revokedAt: new Date() }).where(eq(share.id, id));
}

/** People who signed in through a link, newest first. */
export async function listGuests(): Promise<
  Array<{ id: string; name: string; email: string; joinedAt: Date }>
> {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      joinedAt: sql<Date>`max(${shareMember.joinedAt})`.mapWith(share.createdAt),
    })
    .from(shareMember)
    .innerJoin(user, eq(user.id, shareMember.userId))
    .groupBy(user.id)
    .orderBy(desc(sql`max(${shareMember.joinedAt})`))
    .all();
}

/**
 * What a guest may do with a document through a link. The owner and agents never need one. A
 * reader sees the text; a guest who signed in through a comment link also comments and replies.
 * Using a comment link while signed in records the guest as one of its people.
 */
export async function guestAccess(
  principal: { kind: "owner" | "agent" | "guest"; userId?: string } | null,
  token: string | undefined,
  documentId: string,
  need: "read" | "comment",
): Promise<void> {
  if (principal && principal.kind !== "guest") return;
  if (!token) throw new EvergardenError("forbidden", "This library is private.");
  const found = await openShare(token);
  if (!(await shareCovers(found, documentId))) {
    throw new EvergardenError("forbidden", "This link does not cover this document.");
  }
  if (need === "read") return;
  if (found.permission !== "comment") {
    throw new EvergardenError("forbidden", "This link lets you read, not comment.");
  }
  if (!principal?.userId) throw new EvergardenError("unauthorized", "Sign in to comment.");
  await joinShare(found.id, principal.userId);
}

/** Whether `token` belongs to a link that lets people sign in to comment. */
export async function isCommentLink(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    return (await openShare(token)).permission === "comment";
  } catch {
    return false;
  }
}
