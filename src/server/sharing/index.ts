import { and, desc, eq, ne, sql } from "drizzle-orm";

import { listed, normalizePeople } from "#/lib/people";
import { db } from "#/server/db";
import {
  document,
  folder,
  type ShareAudience,
  sharing,
  type SharePermission,
  type ShareTargetKind,
  type ShareVersions,
  user,
} from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

export type ShareTarget = { kind: ShareTargetKind; id: string };

/** One sharing setting: who, to do what, with which versions, until when. */
export type ShareSettings = {
  audience: ShareAudience;
  /** For `audience: "people"`: emails and `@domains`, lower case. */
  people: string[];
  permission: SharePermission;
  versions: ShareVersions;
  expiresAt: Date | null;
};

/** A document or folder's own setting, and those it inherits from the folders above it. */
export type SharingState = {
  own: ShareSettings | null;
  inherited: Array<ShareSettings & { through: { id: string; name: string } }>;
};

/** What someone other than the owner may do with a document or folder. */
export type Shared = {
  permission: SharePermission;
  versions: ShareVersions;
  /** The outermost shared folder at or above the target: where a guest's folder path starts. */
  root: string | null;
};

export type SharedEntry = ShareSettings & { kind: ShareTargetKind; id: string; name: string };

const RANK: Record<SharePermission, number> = { read: 1, comment: 2 };
/**
 * Shares a document or folder at its own address, or stops sharing it with null. A folder's
 * setting covers everything inside it.
 */
export async function setSharing(
  target: ShareTarget,
  settings: (Omit<ShareSettings, "expiresAt"> & { expiresInDays: number | null }) | null,
): Promise<void> {
  await assertExists(target);
  const where = and(eq(sharing.targetKind, target.kind), eq(sharing.targetId, target.id));
  if (!settings) {
    await db.delete(sharing).where(where);
    return;
  }
  let people: string[] = [];
  if (settings.audience === "people") {
    try {
      people = normalizePeople(settings.people);
    } catch (error) {
      throw new EvergardenError("invalid", error instanceof Error ? error.message : String(error));
    }
  }
  if (settings.audience === "people" && people.length === 0) {
    throw new EvergardenError("invalid", "Add at least one email or @domain.");
  }
  const days = settings.expiresInDays;
  const values = {
    permission: settings.permission,
    audience: settings.audience,
    people,
    versions: settings.versions,
    expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
  };
  await db
    .insert(sharing)
    .values({ targetKind: target.kind, targetId: target.id, ...values })
    .onConflictDoUpdate({ target: [sharing.targetKind, sharing.targetId], set: values });
}

async function assertExists(target: ShareTarget): Promise<void> {
  const table = target.kind === "folder" ? folder : document;
  const found = await db.select({ id: table.id }).from(table).where(eq(table.id, target.id)).get();
  if (!found) throw new EvergardenError("not_found", `No ${target.kind} with id "${target.id}".`);
}

type SettingRow = ShareSettings & {
  kind: ShareTargetKind;
  id: string;
  name: string;
  depth: number | null;
};

/** Every unexpired setting that applies to a target: its own and its folders', in one query. */
async function settingsAbove(target: ShareTarget): Promise<SettingRow[]> {
  const start =
    target.kind === "document"
      ? sql`(select folder_id from document where id = ${target.id})`
      : sql`${target.id}`;
  const rows = await db.all<{
    kind: ShareTargetKind;
    id: string;
    name: string;
    permission: SharePermission;
    audience: ShareAudience;
    people: string;
    versions: ShareVersions;
    expiresAt: number | null;
    depth: number | null;
  }>(sql`
    with recursive up(id, parent_id, depth) as (
      select id, parent_id, 0 from folder where id = ${start}
      union all
      select folder.id, folder.parent_id, up.depth + 1 from folder join up on folder.id = up.parent_id
    )
    select sharing.target_kind as kind, sharing.target_id as id, sharing.permission,
      sharing.audience, sharing.people, sharing.versions, sharing.expires_at as expiresAt,
      coalesce(document.title, folder.name) as name,
      (select depth from up where up.id = sharing.target_id and sharing.target_kind = 'folder') as depth
    from sharing
    left join document on sharing.target_kind = 'document' and document.id = sharing.target_id
    left join folder on sharing.target_kind = 'folder' and folder.id = sharing.target_id
    where (sharing.expires_at is null or sharing.expires_at > ${Date.now()})
      and (
        (sharing.target_kind = 'folder' and sharing.target_id in (select id from up))
        or (sharing.target_kind = ${target.kind} and sharing.target_id = ${target.id})
      )
  `);
  return rows.map(({ people, expiresAt, ...row }) =>
    Object.assign(row, {
      people: parsePeople(people),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }),
  );
}

function parsePeople(raw: string): string[] {
  const value: unknown = JSON.parse(raw);
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function settingsOnly({ audience, people, permission, versions, expiresAt }: ShareSettings) {
  return { audience, people, permission, versions, expiresAt };
}

/** How a target is shared, as its owner sees it: its own setting and the folders' above. */
export async function sharingOf(target: ShareTarget): Promise<SharingState> {
  const rows = await settingsAbove(target);
  const own = rows.find((row) => row.kind === target.kind && row.id === target.id);
  return {
    own: own ? settingsOnly(own) : null,
    inherited: rows
      .filter((row) => row !== own)
      .toSorted((a, b) => (b.depth ?? 0) - (a.depth ?? 0))
      .map((row) => Object.assign(settingsOnly(row), { through: { id: row.id, name: row.name } })),
  };
}

/**
 * What someone who is not the owner may do with a target: the most open of the settings that
 * apply to them. A link setting applies to anyone; a list of people only to its emails and domains.
 */
export async function accessFor(target: ShareTarget, email: string | null): Promise<Shared | null> {
  const rows = (await settingsAbove(target)).filter(
    (row) => row.audience === "link" || listed(row.people, email),
  );
  if (rows.length === 0) return null;
  const permission = rows.some((row) => row.permission === "comment") ? "comment" : "read";
  const versions = rows.some((row) => row.versions === "all") ? "all" : "current";
  const outermost = rows
    .filter((row) => row.depth !== null)
    .toSorted((a, b) => b.depth! - a.depth!)[0];
  return { permission, versions, root: outermost?.id ?? null };
}

/**
 * Checks that someone other than the owner may see, or comment on, a target. The owner and agents
 * always may. Commenting needs comment access and a signed-in guest.
 */
export async function guestAccess(
  principal: { kind: "owner" | "agent" | "guest"; email?: string } | null,
  target: ShareTarget,
  need: "read" | "comment",
): Promise<Shared | null> {
  if (principal && principal.kind !== "guest") return null;
  const shared = await accessFor(target, principal?.email ?? null);
  if (!shared) throw new EvergardenError("forbidden", "This library is private.");
  if (need === "comment") {
    if (RANK[shared.permission] < RANK.comment) {
      throw new EvergardenError("forbidden", "This was shared to read, not to comment on.");
    }
    if (!principal) throw new EvergardenError("unauthorized", "Sign in to comment.");
  }
  return shared;
}

/**
 * Whether `email` may get a sign-in code on a shared page, named `document:<id>` or `folder:<id>`
 * by the page: when it is shared with that email, or shared by link for comments.
 */
export async function mayRequestCode(
  target: string | null | undefined,
  email: string,
): Promise<boolean> {
  const [kind, id] = (target ?? "").split(":");
  if ((kind !== "document" && kind !== "folder") || !id) return false;
  const rows = await settingsAbove({ kind, id });
  return rows.some(
    (row) =>
      (row.audience === "people" && listed(row.people, email)) ||
      (row.audience === "link" && row.permission === "comment"),
  );
}

/** Every document and folder the owner shared, newest first. */
export async function listSharing(): Promise<SharedEntry[]> {
  const rows = await db
    .select({
      kind: sharing.targetKind,
      id: sharing.targetId,
      name: sql<string>`coalesce(${document.title}, ${folder.name}, 'Deleted')`,
      permission: sharing.permission,
      audience: sharing.audience,
      people: sharing.people,
      versions: sharing.versions,
      expiresAt: sharing.expiresAt,
    })
    .from(sharing)
    .leftJoin(document, and(eq(sharing.targetKind, "document"), eq(document.id, sharing.targetId)))
    .leftJoin(folder, and(eq(sharing.targetKind, "folder"), eq(folder.id, sharing.targetId)))
    .orderBy(desc(sharing.createdAt))
    .all();
  return rows;
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
