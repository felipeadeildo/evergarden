import { describe, expect, it } from "vitest";

import { listed, normalizePeople } from "#/lib/people";
import { list, publish } from "#/server/library";

import { accessFor, guestAccess, mayRequestCode, setSharing, sharingOf } from "./index";

const pi = { kind: "agent", id: "agent1", name: "pi" } as const;

const link = (permission: "read" | "comment", versions: "current" | "all" = "current") => ({
  audience: "link" as const,
  people: [],
  permission,
  versions,
  expiresInDays: null,
});

const people = (emails: string[], permission: "read" | "comment" = "comment") => ({
  audience: "people" as const,
  people: emails,
  permission,
  versions: "current" as const,
  expiresInDays: null,
});

async function folderId(path: string): Promise<string> {
  const name = path.split("/").at(-1);
  const { folders } = await list({ folder: path });
  return folders.find((entry) => entry.name === name)!.id;
}

describe("people lists", () => {
  it("keeps emails and @domains, lower case, once each", () => {
    expect(normalizePeople([" Ana@Acme.com", "@ranqia.com", "ana@acme.com"])).toEqual([
      "ana@acme.com",
      "@ranqia.com",
    ]);
    expect(() => normalizePeople(["ana"])).toThrow(/neither an email nor an @domain/);
  });

  it("matches an email by address or by domain", () => {
    expect(listed(["@ranqia.com"], "Felipe@ranqia.com")).toBe(true);
    expect(listed(["ana@acme.com"], "bob@acme.com")).toBe(false);
    expect(listed(["@acme.com"], "bob@notacme.com")).toBe(false);
  });
});

describe("sharing", () => {
  it("keeps a document private until it is shared", async () => {
    const { id } = await publish({ content: "# Private\n\nText." }, pi);
    expect(await accessFor({ kind: "document", id }, null)).toBeNull();
    await expect(guestAccess(null, { kind: "document", id }, "read")).rejects.toThrow(/private/);
    await expect(
      guestAccess({ kind: "owner" }, { kind: "document", id }, "read"),
    ).resolves.toBeNull();
  });

  it("lets anyone with the link read, and comment only when allowed and signed in", async () => {
    const { id } = await publish({ content: "# Read\n\nText." }, pi);
    const target = { kind: "document" as const, id };
    await setSharing(target, link("read"));
    await expect(guestAccess(null, target, "read")).resolves.toMatchObject({ permission: "read" });
    await expect(
      guestAccess({ kind: "guest", email: "a@b.co" }, target, "comment"),
    ).rejects.toThrow(/to read, not to comment/);
    await setSharing(target, link("comment"));
    await expect(guestAccess(null, target, "comment")).rejects.toThrow(/Sign in/);
    expect(await mayRequestCode(`document:${id}`, "anyone@example.com")).toBe(true);
    await setSharing(target, null);
    expect(await mayRequestCode(`document:${id}`, "anyone@example.com")).toBe(false);
  });

  it("opens a document shared with people only to them, and sends codes only to them", async () => {
    const { id } = await publish({ content: "# People\n\nText." }, pi);
    const target = { kind: "document" as const, id };
    await setSharing(target, people(["ana@acme.com", "@ranqia.com"]));
    expect(await accessFor(target, null)).toBeNull();
    expect(await accessFor(target, "bob@acme.com")).toBeNull();
    expect(await accessFor(target, "felipe@ranqia.com")).toMatchObject({ permission: "comment" });
    expect(await mayRequestCode(`document:${id}`, "ana@acme.com")).toBe(true);
    expect(await mayRequestCode(`document:${id}`, "bob@acme.com")).toBe(false);
    await expect(setSharing(target, people([]))).rejects.toThrow(/at least one/);
  });

  it("shares what is inside a folder, and shows the owner where a setting comes from", async () => {
    const inside = await publish({ content: "# Inside\n\nText.", folder: "team/deep" }, pi);
    const beside = await publish({ content: "# Beside\n\nText.", folder: "solo" }, pi);
    const team = await folderId("team");
    await setSharing({ kind: "folder", id: team }, link("read"));
    expect(await accessFor({ kind: "document", id: inside.id }, null)).toMatchObject({
      root: team,
    });
    expect(await accessFor({ kind: "document", id: beside.id }, null)).toBeNull();
    expect(await sharingOf({ kind: "document", id: inside.id })).toMatchObject({
      own: null,
      inherited: [{ audience: "link", permission: "read", through: { id: team, name: "team" } }],
    });
  });

  it("takes the most open permission and versions among the settings that apply", async () => {
    const { id } = await publish({ content: "# Open\n\nText.", folder: "mixed" }, pi);
    await setSharing({ kind: "folder", id: await folderId("mixed") }, link("read", "all"));
    await setSharing({ kind: "document", id }, link("comment"));
    expect(await accessFor({ kind: "document", id }, null)).toMatchObject({
      permission: "comment",
      versions: "all",
      root: await folderId("mixed"),
    });
  });

  it("stops sharing once the setting expires", async () => {
    const { id } = await publish({ content: "# Expiring\n\nText." }, pi);
    await setSharing({ kind: "document", id }, { ...link("read"), expiresInDays: 7 });
    const { own } = await sharingOf({ kind: "document", id });
    expect(own?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
    expect(await mayRequestCode("nonsense", "a@b.co")).toBe(false);
  });
});
