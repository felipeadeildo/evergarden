import { describe, expect, it } from "vitest";

import { setSharing, sharingOf } from "#/server/sharing";

import { findFolder, folderPath } from "./folders";
import { getDocument, publish, read } from "./index";
import {
  deleteDocument,
  deleteFolder,
  destroyDocument,
  folderAt,
  moveDocument,
  moveFolder,
  renameDocument,
  renameFolder,
  restoreDocument,
  trash,
} from "./organize";

const pi = { kind: "agent", id: "key1", name: "pi" } as const;
const felipe = { kind: "user", id: "user1", name: "Felipe" } as const;
const link = {
  audience: "link" as const,
  people: [],
  permission: "read" as const,
  versions: "current" as const,
  expiresInDays: null,
};

async function pathOf(id: string) {
  const { document } = await read(id);
  return (await folderPath(document.folderId)).map((step) => step.name).join("/");
}

describe("documents", () => {
  it("move between folders and to the top of the library", async () => {
    const { id } = await publish({ content: "# Plan", folder: "work/a" }, pi);
    await moveDocument(id, await folderAt("work/b"));
    expect(await pathOf(id)).toBe("work/b");
    await moveDocument(id, null);
    expect(await pathOf(id)).toBe("");
  });

  it("rename through a new version that carries the title", async () => {
    const { id } = await publish({ content: "---\nsummary: Short.\n---\n# Old\n\nBody." }, pi);
    const { version } = await renameDocument(id, "New name", felipe);
    const current = await read(id);
    expect(version).toBe(2);
    expect(current.document.title).toBe("New name");
    expect(current.source).toBe("---\nsummary: Short.\n---\n# New name\n\nBody.");
    expect(current.version.authorName).toBe("Felipe");
    await expect(renameDocument(id, "  ", felipe)).rejects.toThrow(/1 to 200/);
  });

  it("go to the trash unshared, come back, or go for good", async () => {
    const { id } = await publish({ content: "# Gone soon", folder: "trash-test" }, pi);
    await setSharing({ kind: "document", id }, link);
    await deleteDocument(id);

    await expect(getDocument(id)).rejects.toThrow(/No document/);
    expect((await sharingOf({ kind: "document", id })).own).toBeNull();
    expect((await trash()).find((entry) => entry.id === id)?.deletedFrom).toBe("trash-test");

    await restoreDocument(id);
    expect(await pathOf(id)).toBe("trash-test");
    await deleteDocument(id);
    await destroyDocument(id);
    expect((await trash()).some((entry) => entry.id === id)).toBe(false);
  });
});

describe("folders", () => {
  it("rename, refusing a name taken beside them", async () => {
    const id = await folderAt("names/first");
    await folderAt("names/second");
    await renameFolder(id!, "renamed");
    expect(await findFolder(["names", "renamed"])).toBe(id);
    await expect(renameFolder(id!, "second")).rejects.toThrow(/already a folder/);
    await expect(renameFolder(id!, "a/b")).rejects.toThrow(/no slash/);
  });

  it("move with what they hold, but never inside themselves", async () => {
    const id = await folderAt("tree/branch");
    const leaf = await folderAt("tree/branch/leaf");
    const { id: doc } = await publish({ content: "# On the leaf", folder: "tree/branch/leaf" }, pi);
    await moveFolder(id!, await folderAt("elsewhere"));
    expect(await pathOf(doc)).toBe("elsewhere/branch/leaf");
    await expect(moveFolder(id!, leaf)).rejects.toThrow(/inside itself/);
    expect(await findFolder(["elsewhere", "branch"])).toBe(id);
  });

  it("delete into the trash, and restoring a document brings its folders back", async () => {
    const id = await folderAt("old/project");
    const { id: doc } = await publish({ content: "# Deep", folder: "old/project/notes" }, pi);
    await setSharing({ kind: "folder", id: id! }, link);
    await deleteFolder(id!);

    expect(await findFolder(["old", "project"])).toBeNull();
    expect((await trash()).find((entry) => entry.id === doc)?.deletedFrom).toBe(
      "old/project/notes",
    );
    await restoreDocument(doc);
    expect(await pathOf(doc)).toBe("old/project/notes");
    const restored = await findFolder(["old", "project"]);
    expect((await sharingOf({ kind: "folder", id: restored! })).own).toBeNull();
  });
});
