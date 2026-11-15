import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { rename } from "./account";
import { addComment, threads } from "./comments";
import { publish } from "./library";

describe("rename", () => {
  it("renames the person and what they already signed", async () => {
    await env.DB.prepare(
      "insert into user (id, name, email) values ('u1', 'evergarden', 'evergarden@fa.dev.br')",
    ).run();
    const { id } = await publish(
      { content: "# Report\n\nEC2 was 41% of the bill." },
      { kind: "agent", id: "a1", name: "pi" },
    );
    await addComment(
      id,
      { version: 1, kind: "text", start: 10, end: 13, body: "Why?" },
      { kind: "user", id: "u1", name: "evergarden" },
    );

    expect(await rename("u1", "  Felipe  ")).toBe("Felipe");
    const name = await env.DB.prepare("select name from user where id = 'u1'").first<{
      name: string;
    }>();
    expect(name?.name).toBe("Felipe");
    expect((await threads(id))[0]?.author.name).toBe("Felipe");
  });

  it("refuses an empty name", async () => {
    await expect(rename("u1", "   ")).rejects.toThrow(/1 to 60/);
  });
});
