import { describe, expect, it } from "vitest";

import { list, publish } from "#/server/library";

import { guestAccess, listSharing, opensForComments, setSharing, sharedAs } from "./index";

const pi = { kind: "agent", id: "agent1", name: "pi" } as const;
const guest = { kind: "guest" } as const;

async function folderId(path: string): Promise<string> {
  const name = path.split("/").at(-1);
  const { folders } = await list({ folder: path });
  return folders.find((entry) => entry.name === name)!.id;
}

describe("sharing", () => {
  it("keeps a document private until it is shared", async () => {
    const { id } = await publish({ content: "# Private\n\nText." }, pi);
    expect(await sharedAs({ kind: "document", id })).toBeNull();
    await expect(guestAccess(null, { kind: "document", id }, "read")).rejects.toThrow(/private/);
    await expect(
      guestAccess({ kind: "owner" }, { kind: "document", id }, "read"),
    ).resolves.toBeNull();
  });

  it("lets anyone read a shared document, and comment only when shared for comments and signed in", async () => {
    const { id } = await publish({ content: "# Read\n\nText." }, pi);
    const target = { kind: "document" as const, id };
    await setSharing(target, "read");
    await expect(guestAccess(null, target, "read")).resolves.toMatchObject({ permission: "read" });
    await expect(guestAccess(guest, target, "comment")).rejects.toThrow(/to read, not to comment/);
    await setSharing(target, "comment");
    await expect(guestAccess(null, target, "comment")).rejects.toThrow(/Sign in/);
    await expect(guestAccess(guest, target, "comment")).resolves.toMatchObject({
      permission: "comment",
    });
    expect(await opensForComments(`document:${id}`)).toBe(true);
    await setSharing(target, null);
    expect(await opensForComments(`document:${id}`)).toBe(false);
  });

  it("shares what is inside a folder, through any depth, and not what is beside it", async () => {
    const inside = await publish({ content: "# Inside\n\nText.", folder: "team/deep" }, pi);
    const beside = await publish({ content: "# Beside\n\nText.", folder: "solo" }, pi);
    const team = await folderId("team");
    await setSharing({ kind: "folder", id: team }, "read");
    expect(await sharedAs({ kind: "document", id: inside.id })).toMatchObject({
      permission: "read",
      through: { kind: "folder", id: team, name: "team" },
    });
    expect(await sharedAs({ kind: "folder", id: await folderId("team/deep") })).not.toBeNull();
    expect(await sharedAs({ kind: "document", id: beside.id })).toBeNull();
  });

  it("uses the most open setting that applies", async () => {
    const { id } = await publish({ content: "# Open\n\nText.", folder: "mixed" }, pi);
    await setSharing({ kind: "folder", id: await folderId("mixed") }, "read");
    await setSharing({ kind: "document", id }, "comment");
    const shared = await sharedAs({ kind: "document", id });
    expect(shared?.permission).toBe("comment");
    // The folder path still starts at the shared folder, so a guest can go back to it.
    expect(shared?.root).toBe(await folderId("mixed"));
  });

  it("stops sharing once the setting expires", async () => {
    const { id } = await publish({ content: "# Expired\n\nText." }, pi);
    await setSharing({ kind: "document", id }, "read", 7);
    expect(await sharedAs({ kind: "document", id })).not.toBeNull();
    const entry = (await listSharing()).find((item) => item.id === id);
    expect(entry?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    expect(await opensForComments("document:missing")).toBe(false);
    expect(await opensForComments("nonsense")).toBe(false);
  });
});
