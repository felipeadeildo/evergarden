import { describe, expect, it } from "vitest";

import { MAX_FILE_BYTES } from "#/lib/files";

import { getDraft, publishDraft } from "./drafts";
import { attachFile, detachFile, openFile } from "./files";
import { publish, read, update } from "./index";

const pi = { kind: "agent", id: "key1", name: "pi" } as const;

function bytes(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

async function textOf(stream: ReadableStream): Promise<string> {
  return new Response(stream).text();
}

describe("files", () => {
  it("wait in the draft, then belong to the version it becomes", async () => {
    const { id } = await publish({ content: "# Chart\n\n![the chart](chart.png)" }, pi);
    await attachFile(id, "chart.png", bytes("png one"), pi);
    expect((await getDraft(id))?.files.map((file) => file.name)).toEqual(["chart.png"]);
    expect((await read(id)).files).toEqual([]);

    const { version } = await publishDraft(id);
    const [file] = (await read(id)).files;
    expect(version).toBe(2);
    expect(file).toMatchObject({ name: "chart.png", size: 7, type: "image/png" });
    expect(await textOf((await openFile(id, "chart.png", undefined)).body)).toBe("png one");
    await expect(openFile(id, "chart.png", 1)).rejects.toThrow(/no file named/);
  });

  it("keep each version's own copy, and carry over through plain updates", async () => {
    const { id } = await publish({ content: "# Data" }, pi);
    await attachFile(id, "data.csv", bytes("a,b\n1,2"), pi);
    await publishDraft(id);
    await attachFile(id, "data.csv", bytes("a,b\n3,4"), pi);
    await publishDraft(id);
    await update(id, { content: "# Data\n\nNow with a sentence." }, pi);

    expect(await textOf((await openFile(id, "data.csv", 2)).body)).toBe("a,b\n1,2");
    expect(await textOf((await openFile(id, "data.csv", 4)).body)).toBe("a,b\n3,4");
    expect((await read(id)).files[0]?.type).toBe("text/csv");
  });

  it("refuse bad names and big files, and come off with detach", async () => {
    const { id } = await publish({ content: "# Limits" }, pi);
    await expect(attachFile(id, "../etc/passwd", bytes("x"), pi)).rejects.toThrow(
      /not a file name/,
    );
    await expect(attachFile(id, ".env", bytes("x"), pi)).rejects.toThrow(/not a file name/);
    await expect(
      attachFile(id, "big.zip", new ArrayBuffer(MAX_FILE_BYTES + 1), pi),
    ).rejects.toThrow(/at most 10 MB/);

    await attachFile(id, "notes.txt", bytes("hi"), pi);
    await publishDraft(id);
    await detachFile(id, "notes.txt", pi);
    await publishDraft(id);
    expect((await read(id)).files).toEqual([]);
    await expect(detachFile(id, "notes.txt", pi)).rejects.toThrow(/no file named/);
  });

  it("treat a version with the same text but other files as a change", async () => {
    const { id } = await publish({ content: "# Same text" }, pi);
    await attachFile(id, "a.txt", bytes("a"), pi);
    const { changed, version } = await publishDraft(id);
    expect({ changed, version }).toEqual({ changed: true, version: 2 });
  });
});
