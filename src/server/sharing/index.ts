import { and, desc, eq, ne, sql } from "drizzle-orm";

import { db } from "#/server/db";
import {
  document,
  folder,
  sharing,
  type SharePermission,
  type ShareTargetKind,
  user,
} from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

export type ShareTarget = { kind: ShareTargetKind; id: string };

/** How a document or folder is shared, and through which of itself or the folders above it. */
export type Shared = {
  permission: SharePermission;
  /** The document or folder whose setting this is; a folder above the target, when inherited. */
  through: ShareTarget & { name: string };
  /** The outermost shared folder at or above the target: where a guest's folder path starts. */
  root: string | null;
  expiresAt: Date | null;
};

export type SharedEntry = Shared["through"] & {
  permission: SharePermission;
  createdAt: Date;
  expiresAt: Date | null;
};

const RANK: Record<SharePermission, number> = { read: 1, comment: 2 };

/**
 * Shares a document or a folder with anyone who has its address, or stops sharing it when
 * `permission` is null. A folder's setting covers everything inside it.
 */
export async function setSharing(
  target: ShareTarget,
  permission: SharePermission | null,
  expiresInDays: number | null = null,
): Promise<void> {
  await assertExists(target);
  const where = and(eq(sharing.targetKind, target.kind), eq(sharing.targetId, target.id));
  if (!permission) {
    await db.delete(sharing).where(where);
    return;
  }
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null;
  await db
    .insert(sharing)
    .values({ targetKind: target.kind, targetId: target.id, permission, expiresAt })
    .onConflictDoUpdate({
      target: [sharing.targetKind, sharing.targetId],
      set: { permission, expiresAt, createdAt: new Date() },
    });
}

async function assertExists(target: ShareTarget): Promise<void> {
  const table = target.kind === "folder" ? folder : document;
  const found = await db.select({ id: table.id }).from(table).where(eq(table.id, target.id)).get();
  if (!found) throw new EvergardenError("not_found", `No ${target.kind} with id "${target.id}".`);
}

/**
 * The most open setting that applies to a document or a folder: its own, or one on a folder
 * above it. Expired settings no longer count. One query, from the target up.
 */
export async function sharedAs(target: ShareTarget): Promise<Shared | null> {
  const start =
    target.kind === "document"
      ? sql`(select folder_id from document where id = ${target.id})`
      : sql`${target.id}`;
  const rows = await db.all<{
    kind: ShareTargetKind;
    id: string;
    name: string;
    permission: SharePermission;
    expiresAt: number | null;
    depth: number | null;
  }>(sql`
    with recursive up(id, parent_id, depth) as (
      select id, parent_id, 0 from folder where id = ${start}
      union all
      select folder.id, folder.parent_id, up.depth + 1 from folder join up on folder.id = up.parent_id
    )
    select sharing.target_kind as kind, sharing.target_id as id, sharing.permission,
      sharing.expires_at as expiresAt,
      (select depth from up where up.id = sharing.target_id and sharing.target_kind = 'folder') as depth,
      coalesce(document.title, folder.name) as name
    from sharing
    left join document on sharing.target_kind = 'document' and document.id = sharing.target_id
    left join folder on sharing.target_kind = 'folder' and folder.id = sharing.target_id
    where (sharing.expires_at is null or sharing.expires_at > ${Date.now()})
      and (
        (sharing.target_kind = 'folder' and sharing.target_id in (select id from up))
        or (sharing.target_kind = ${target.kind} and sharing.target_id = ${target.id})
      )
  `);
  const best = rows.toSorted((a, b) => RANK[b.permission] - RANK[a.permission])[0];
  if (!best) return null;
  const outermost = rows
    .filter((row) => row.depth !== null)
    .toSorted((a, b) => b.depth! - a.depth!)[0];
  return {
    permission: best.permission,
    through: { kind: best.kind, id: best.id, name: best.name },
    root: outermost?.id ?? null,
    expiresAt: best.expiresAt ? new Date(best.expiresAt) : null,
  };
}

/**
 * Checks that someone other than the owner may see, or comment on, a document. The owner and
 * agents always may. Reading needs the document shared; commenting needs it shared for
 * comments and the guest signed in.
 */
export async function guestAccess(
  principal: { kind: "owner" | "agent" | "guest" } | null,
  target: ShareTarget,
  need: "read" | "comment",
): Promise<Shared | null> {
  if (principal && principal.kind !== "guest") return null;
  const shared = await sharedAs(target);
  if (!shared) throw new EvergardenError("forbidden", "This library is private.");
  if (need === "comment") {
    if (shared.permission !== "comment") {
      throw new EvergardenError("forbidden", "This was shared to read, not to comment on.");
    }
    if (!principal) throw new EvergardenError("unauthorized", "Sign in to comment.");
  }
  return shared;
}

/**
 * Whether a guest may get a sign-in code to comment on `target`, sent as `document:<id>` or
 * `folder:<id>` by the page they are on. Anyone else gets no email.
 */
export async function opensForComments(target: string | null | undefined): Promise<boolean> {
  const [kind, id] = (target ?? "").split(":");
  if ((kind !== "document" && kind !== "folder") || !id) return false;
  return (await sharedAs({ kind, id }))?.permission === "comment";
}

/** Every document and folder the owner shared, newest first. */
export async function listSharing(): Promise<SharedEntry[]> {
  return db
    .select({
      kind: sharing.targetKind,
      id: sharing.targetId,
      name: sql<string>`coalesce(${document.title}, ${folder.name}, 'Deleted')`,
      permission: sharing.permission,
      createdAt: sharing.createdAt,
      expiresAt: sharing.expiresAt,
    })
    .from(sharing)
    .leftJoin(document, and(eq(sharing.targetKind, "document"), eq(document.id, sharing.targetId)))
    .leftJoin(folder, and(eq(sharing.targetKind, "folder"), eq(folder.id, sharing.targetId)))
    .orderBy(desc(sharing.createdAt))
    .all();
}

/** People who signed in to comment on something shared: every account but the owner's. */
export async function listGuests(
  ownerId: string,
): Promise<Array<{ id: string; name: string; email: string; joinedAt: Date }>> {
  return db
    .select({ id: user.id, name: user.name, email: user.email, joinedAt: user.createdAt })
    .from(user)
    .where(ne(user.id, ownerId))
    .orderBy(desc(user.createdAt))
    .all();
}

/** Removes a guest's account, which signs them out everywhere. Their comments stay. */
export async function removeGuest(ownerId: string, id: string): Promise<void> {
  if (id === ownerId) throw new EvergardenError("invalid", "The owner cannot be removed.");
  await db.delete(user).where(eq(user.id, id));
}
