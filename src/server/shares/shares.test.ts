import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { list, publish } from "#/server/library";

import {
  createShare,
  guestAccess,
  isCommentLink,
  listShares,
  openShare,
  revokeShare,
  shareCovers,
  shareCoversFolder,
} from "./index";

const pi = { kind: "agent", id: "agent1", name: "pi" } as const;

async function guest(id: string) {
  await env.DB.prepare("insert or ignore into user (id, name, email) values (?, ?, ?)")
    .bind(id, id, `${id}@example.com`)
    .run();
  return { kind: "guest" as const, userId: id };
}

describe("shares", () => {
  it("opens a document link by its token, and only by it", async () => {
    const { id } = await publish({ content: "# Shared\n\nText." }, pi);
    const { token } = await createShare({
      targetKind: "document",
      targetId: id,
      permission: "read",
    });
    expect(token).toMatch(/^[0-9a-z]{24}$/);
    const found = await openShare(token, true);
    expect(found).toMatchObject({ targetKind: "document", targetId: id, permission: "read" });
    await expect(openShare("x".repeat(24))).rejects.toThrow(/revoked or has expired/);
  });

  it("pins a document link to the version it was made from", async () => {
    const { id } = await publish({ content: "# Pinned\n\nText." }, pi);
    const { token } = await createShare({
      targetKind: "document",
      targetId: id,
      permission: "read",
      pinned: true,
    });
    expect((await openShare(token)).versionNumber).toBe(1);
  });

  it("stops working once revoked", async () => {
    const { id } = await publish({ content: "# Revoked\n\nText." }, pi);
    const created = await createShare({
      targetKind: "document",
      targetId: id,
      permission: "comment",
    });
    expect(await isCommentLink(created.token)).toBe(true);
    await revokeShare(created.id);
    expect(await isCommentLink(created.token)).toBe(false);
    expect((await listShares()).some((entry) => entry.id === created.id)).toBe(false);
  });

  it("covers every document and folder below a shared folder, and nothing else", async () => {
    const inside = await publish({ content: "# Inside\n\nText.", folder: "shared/deep" }, pi);
    const outside = await publish({ content: "# Outside\n\nText.", folder: "private" }, pi);
    const { folders } = await list({ folder: "shared" });
    const root = folders.find((entry) => entry.name === "shared")!;
    const deep = folders.find((entry) => entry.name === "deep")!;
    const found = await openShare(
      (await createShare({ targetKind: "folder", targetId: root.id, permission: "read" })).token,
    );
    expect(await shareCovers(found, inside.id)).toBe(true);
    expect(await shareCovers(found, outside.id)).toBe(false);
    expect(await shareCoversFolder(found, deep.id)).toBe(true);
  });

  it("lets guests read through any link, and comment only through a comment link once signed in", async () => {
    const { id } = await publish({ content: "# Guests\n\nText." }, pi);
    const read = await createShare({ targetKind: "document", targetId: id, permission: "read" });
    const comment = await createShare({
      targetKind: "document",
      targetId: id,
      permission: "comment",
    });
    await expect(guestAccess(null, read.token, id, "read")).resolves.toBeUndefined();
    await expect(guestAccess(null, undefined, id, "read")).rejects.toThrow(/private/);
    await expect(guestAccess(await guest("g1"), read.token, id, "comment")).rejects.toThrow(
      /read, not comment/,
    );
    await expect(guestAccess(null, comment.token, id, "comment")).rejects.toThrow(/Sign in/);
    await expect(
      guestAccess(await guest("g2"), comment.token, id, "comment"),
    ).resolves.toBeUndefined();
    const entry = (await listShares()).find((share) => share.id === comment.id);
    expect(entry?.members).toBe(1);
  });
});
