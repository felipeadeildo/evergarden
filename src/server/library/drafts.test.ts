import { describe, expect, it } from "vitest";

import { applyEdits, discardDraft, editDraft, getDraft, publishDraft } from "./drafts";
import { publish, read, update } from "./index";

const pi = { kind: "agent", id: "key1", name: "pi" } as const;

describe("applyEdits", () => {
  it("replaces each passage once, in order", () => {
    const text = applyEdits("one two three", [
      { old: "two", new: "2" },
      { old: "2 three", new: "2, 3" },
    ]);
    expect(text).toBe("one 2, 3");
  });

  it("refuses a passage that is missing or ambiguous, unless asked for all", () => {
    expect(() => applyEdits("a b a", [{ old: "c", new: "d" }])).toThrow(/does not appear/);
    expect(() => applyEdits("a b a", [{ old: "a", new: "d" }])).toThrow(/appears 2 times/);
    expect(applyEdits("a b a", [{ old: "a", new: "d", all: true }])).toBe("d b d");
  });

  it("keeps dollar signs in the new text as they are", () => {
    expect(applyEdits("cost: x", [{ old: "x", new: "$& and $1" }])).toBe("cost: $& and $1");
  });
});

describe("drafts", () => {
  it("collects edits and publishes them as one version", async () => {
    const { id } = await publish({ content: "# Plan\n\nUse KV for the cache." }, pi);
    await editDraft(id, [{ old: "KV", new: "the Cache API" }], pi);
    const draft = await editDraft(id, [{ old: "cache.", new: "cache, per colo." }], pi);
    expect(draft).toMatchObject({ baseVersion: 1, edits: 2 });
    expect((await read(id)).source).toContain("Use KV");

    expect(await publishDraft(id)).toMatchObject({ version: 2, changed: true });
    expect((await read(id)).source).toContain("Use the Cache API for the cache, per colo.");
    expect(await getDraft(id)).toBeNull();
  });

  it("refuses to publish over a version saved since the draft began", async () => {
    const { id } = await publish({ content: "# Race\n\nFirst text." }, pi);
    await editDraft(id, [{ old: "First", new: "Draft" }], pi);
    await update(id, { content: "# Race\n\nSomeone else's text." }, pi);
    await expect(publishDraft(id)).rejects.toThrow(/version 2/);
    await discardDraft(id);
    expect(await getDraft(id)).toBeNull();
  });
});
