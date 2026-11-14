import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { normaliseRepo } from "./folders";
import {
  folderContents,
  folderInfo,
  list,
  markRead,
  publish,
  read,
  recent,
  rendered,
  search,
  update,
  versions,
  withPlaces,
} from "./index";

const pi = { kind: "agent", id: "key1", name: "pi" } as const;
const felipe = { kind: "user", id: "user1", name: "Felipe" } as const;

describe("publish", () => {
  it("creates a document titled by its heading, in the named folder", async () => {
    const { id, version, created } = await publish(
      { content: "# AWS costs, November\n\nEC2 was 41% of the bill.", folder: "reports/2026" },
      pi,
    );
    expect({ version, created }).toEqual({ version: 1, created: true });
    expect(id).toMatch(/^[0-9a-z]{10}$/);

    const { document, source } = await read(id);
    expect(document.title).toBe("AWS costs, November");
    expect(document.updatedBy).toBe("pi");
    expect(source).toContain("EC2 was 41%");

    const { folders } = await list({ folder: "reports/2026" });
    expect(folders.map((entry) => entry.name)).toEqual(["2026"]);
  });

  it("returns the existing document when the same content is published again", async () => {
    const first = await publish({ content: "# Retry\n\nSame text." }, pi);
    const second = await publish({ content: "# Retry\n\nSame text." }, pi);
    expect(second).toEqual({ id: first.id, version: 1, created: false });
  });

  it("files documents for a repository in its linked folder", async () => {
    const first = await publish(
      { content: "# Ada plan", folder: "ranqia/ada", repo: "git@github.com:Ranqia/ada.git" },
      pi,
    );
    const second = await publish(
      { content: "# Ada spec", repo: "https://github.com/ranqia/ada" },
      pi,
    );
    const { documents } = await list({ repo: "github.com/ranqia/ada" });
    expect(documents.map((entry) => entry.id).toSorted()).toEqual([first.id, second.id].toSorted());
  });

  it("rejects empty content", async () => {
    await expect(publish({ content: "  \n" }, pi)).rejects.toThrow("The content is empty.");
  });
});

describe("update", () => {
  it("saves a new version and keeps the old one readable", async () => {
    const { id } = await publish({ content: "# Draft\n\nFirst take." }, pi);
    const updated = await update(id, { content: "# Draft\n\nSecond take." }, felipe);
    expect(updated).toEqual({ id, version: 2, changed: true });

    expect((await read(id, 1)).source).toContain("First take.");
    expect((await read(id)).document.updatedBy).toBe("Felipe");
    expect((await versions(id)).map((entry) => entry.number)).toEqual([2, 1]);
  });

  it("saves nothing when the content did not change", async () => {
    const { id } = await publish({ content: "# Stable" }, pi);
    expect(await update(id, { content: "# Stable" }, pi)).toEqual({
      id,
      version: 1,
      changed: false,
    });
  });

  it("refuses to overwrite a newer version", async () => {
    const { id } = await publish({ content: "# Race" }, pi);
    await update(id, { content: "# Race\n\nYours." }, felipe);
    await expect(update(id, { content: "# Race\n\nMine.", baseVersion: 1 }, pi)).rejects.toThrow(
      "is at version 2",
    );
  });

  it("fails for an unknown document", async () => {
    await expect(update("nope", { content: "x" }, pi)).rejects.toThrow(
      'No document with id "nope".',
    );
  });
});

describe("search", () => {
  it("finds prefixes of words, ignoring accents, and ranks titles first", async () => {
    const inTitle = await publish({ content: "# Transferência de dados\n\nResumo." }, pi);
    const inBody = await publish({ content: "# Outro\n\nA transferencia via NAT gateway." }, pi);
    const hits = await search("transfer");
    expect(hits.map((hit) => hit.id)).toEqual([inTitle.id, inBody.id]);
    expect((await search("nat gate"))[0]?.excerpt).toContain("«NAT» «gateway»");
  });

  it("ignores FTS5 operators in the query", async () => {
    await expect(search('"unbalanced OR (')).resolves.toBeInstanceOf(Array);
  });
});

describe("normaliseRepo", () => {
  it.each([
    ["git@github.com:Ranqia/ada.git", "github.com/ranqia/ada"],
    ["https://github.com/ranqia/ada/", "github.com/ranqia/ada"],
    ["ssh://git@gitlab.com/group/sub/repo.git", "gitlab.com/group/sub/repo"],
    ["github.com/ranqia/ada", "github.com/ranqia/ada"],
  ])("%s gives %s", (input, expected) => {
    expect(normaliseRepo(input)).toBe(expected);
  });
});

describe("folderContents", () => {
  it("lists what sits directly in a folder, counting documents in subfolders", async () => {
    await publish({ content: "# Q1 plan", folder: "browse/plans" }, pi);
    await publish({ content: "# Q2 plan", folder: "browse/plans" }, pi);
    await publish({ content: "# Old plan", folder: "browse/plans/archive" }, pi);
    await publish({ content: "# Browse notes", folder: "browse" }, pi);

    const { folders: top } = await folderContents(null);
    const browse = top.find((entry) => entry.name === "browse");
    expect(browse?.documents).toBe(4);

    const inside = await folderContents(browse!.id);
    expect(inside.documents.map((entry) => entry.title)).toEqual(["Browse notes"]);
    expect(inside.folders.map((entry) => [entry.name, entry.documents])).toEqual([["plans", 3]]);
  });

  it("pages documents and counts the ones left", async () => {
    for (let i = 0; i < 52; i++) await publish({ content: `# Page ${i}`, folder: "paged" }, pi);
    const { folders } = await folderContents(null);
    const paged = folders.find((entry) => entry.name === "paged")!;

    const first = await folderContents(paged.id);
    expect([first.documents.length, first.more]).toEqual([50, 2]);
    const second = await folderContents(paged.id, 50);
    expect([second.documents.length, second.more, second.folders]).toEqual([2, 0, []]);
  });
});

describe("withPlaces", () => {
  it("adds the folder path of each document", async () => {
    const { id } = await publish({ content: "# Placed", folder: "reports/2026/q4" }, pi);
    const { document } = await read(id);
    const [placed] = await withPlaces([document]);
    expect(placed?.place).toBe("reports/2026/q4");
  });
});

describe("recent", () => {
  it("lists the newest documents and marks the ones the reader has not opened", async () => {
    const first = await publish({ content: "# Seen report", folder: "recent" }, pi);
    const second = await publish({ content: "# Unseen report", folder: "recent" }, pi);
    await env.DB.prepare(
      "insert or ignore into user (id, name, email, email_verified, created_at, updated_at) values ('reader', 'Reader', 'reader@example.com', 0, 0, 0)",
    ).run();
    await markRead("reader", first.id, 1);

    const entries = await recent("reader", 50);
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    expect(byId.get(first.id)?.unread).toBe(false);
    expect(byId.get(second.id)?.unread).toBe(true);
    expect(byId.get(second.id)?.place).toBe("recent");
  });
});

describe("folderInfo", () => {
  it("returns a folder with the path down to it", async () => {
    await publish({ content: "# Inner", folder: "info/inner" }, pi);
    const { folders } = await list({ folder: "info/inner" });
    const detail = await folderInfo(folders[0]!.id);
    expect(detail.path.map((step) => step.name)).toEqual(["info", "inner"]);
    expect(detail.documents).toBe(1);
  });

  it("fails for an unknown folder", async () => {
    await expect(folderInfo("nope")).rejects.toThrow("no folder");
  });
});

describe("rendered", () => {
  it("reads the tree back from the cache", async () => {
    const { id } = await publish(
      { content: "# Cached\n\n## Compute\n\nEC2 was **41%** of the bill." },
      pi,
    );
    const { version } = await read(id);
    const tree = await rendered(version.sha256);
    expect(tree.headings).toEqual([{ depth: 2, id: "compute", text: "Compute" }]);
    expect(JSON.stringify(tree.tree)).toContain("41%");
  });

  it("renders again when the cache comes from another renderer version", async () => {
    const { id } = await publish({ content: "# Stale\n\n## Section\n\nText." }, pi);
    const { version } = await read(id);
    await env.DB.prepare("update content set renderer_version = 0 where sha256 = ?")
      .bind(version.sha256)
      .run();
    expect((await rendered(version.sha256)).headings[0]?.text).toBe("Section");
    const row = await env.DB.prepare("select renderer_version from content where sha256 = ?")
      .bind(version.sha256)
      .first<{ renderer_version: number }>();
    expect(row?.renderer_version).toBeGreaterThan(0);
  });
});
