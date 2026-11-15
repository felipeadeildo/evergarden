import { describe, expect, it } from "vitest";

import { publish, read, update } from "#/server/library";

import {
  acceptSuggestion,
  addComment,
  addReply,
  commentOn,
  openComments,
  reopen,
  resolve,
  threads,
} from "./index";

const pi = { kind: "agent", id: "agent1", name: "pi" } as const;
const felipe = { kind: "user", id: "user1", name: "felipe" } as const;

const REPORT = `# AWS costs, November

EC2 was 41% of the bill. Data transfer is the second biggest line item.

Most of it left through one NAT gateway.
`;

async function report() {
  const { id } = await publish({ content: REPORT }, pi);
  return id;
}

function at(passage: string) {
  const start = REPORT.indexOf(passage);
  return { start, end: start + passage.length };
}

describe("comments", () => {
  it("anchors a comment to the passage the page selected", async () => {
    const id = await report();
    await addComment(
      id,
      { version: 1, kind: "text", ...at("Data transfer"), body: "Is this NAT traffic?" },
      felipe,
    );
    const [thread] = await threads(id);
    expect(thread?.anchor.exact).toBe("Data transfer");
    expect(thread?.anchor.suffix.startsWith(" is the second")).toBe(true);
    expect(thread?.author).toEqual({ kind: "user", name: "felipe" });
  });

  it("refuses a comment made on a version that is no longer current", async () => {
    const id = await report();
    await update(id, { content: `${REPORT}\nA new line.\n` }, pi);
    await expect(
      addComment(id, { version: 1, kind: "text", ...at("EC2"), body: "x" }, felipe),
    ).rejects.toThrow(/version 2/);
  });

  it("lets an agent comment on a passage it quotes", async () => {
    const id = await report();
    await commentOn(id, { passage: "41% of the bill", body: "Does this include tax?" }, pi);
    const [thread] = await threads(id);
    expect(thread?.anchor.start).toBe(REPORT.indexOf("41%"));
    await expect(commentOn(id, { passage: "the", body: "x" }, pi)).rejects.toThrow(
      /more than once/,
    );
    await expect(commentOn(id, { passage: "S3", body: "x" }, pi)).rejects.toThrow(/not in/);
  });

  it("keeps a comment on its passage when the text around it changes", async () => {
    const id = await report();
    await addComment(
      id,
      { version: 1, kind: "text", ...at("one NAT gateway"), body: "Which?" },
      felipe,
    );
    await addComment(id, { version: 1, kind: "text", ...at("41%"), body: "Source?" }, felipe);
    const next = REPORT.replace(
      "# AWS costs, November\n",
      "# AWS costs, November\n\nSummary first.\n",
    ).replace("41%", "about 40%");
    await update(id, { content: next }, pi);

    const [moved, detached] = await threads(id);
    expect(moved?.status).toBe("open");
    expect(moved?.version).toBe(2);
    expect(next.slice(moved!.anchor.start, moved!.anchor.end)).toBe("one NAT gateway");
    expect(detached?.status).toBe("detached");
    expect(detached?.version).toBe(1);
  });

  it("applies an accepted suggestion as a new version and resolves it", async () => {
    const id = await report();
    const commentId = await addComment(
      id,
      {
        version: 1,
        kind: "text",
        ...at("second biggest"),
        body: "Be exact.",
        suggestion: "second largest",
      },
      felipe,
    );
    expect(await acceptSuggestion(commentId, felipe)).toBe(2);
    expect((await read(id)).source).toContain("the second largest line item");
    expect((await threads(id))[0]?.status).toBe("resolved");
  });

  it("threads replies, resolves and reopens", async () => {
    const id = await report();
    const commentId = await addComment(
      id,
      { version: 1, kind: "text", ...at("EC2"), body: "Why?" },
      felipe,
    );
    await addReply(commentId, "Instances run all month.", pi);
    await resolve(commentId, felipe, "Makes sense.");
    let [thread] = await threads(id);
    expect(thread?.status).toBe("resolved");
    expect(thread?.replies.map((item) => item.body)).toEqual([
      "Instances run all month.",
      "Makes sense.",
    ]);
    await reopen(commentId);
    [thread] = await threads(id);
    expect(thread?.status).toBe("open");
  });
});

describe("openComments", () => {
  it("lists what the agent has not seen as new, once", async () => {
    const id = await report();
    const commentId = await addComment(
      id,
      { version: 1, kind: "text", ...at("one NAT gateway"), body: "Which one?" },
      felipe,
    );
    const first = await openComments(id);
    expect(first).toContain(`### ${commentId} on text, open, new`);
    expect(first).toContain(">>>one NAT gateway<<<");
    expect(first).toContain("- felipe: Which one?");

    expect(await openComments(id)).not.toContain("new");
    await addReply(commentId, "The one in us-east-1?", felipe);
    expect(await openComments(id)).toContain("open, new");
  });
});
