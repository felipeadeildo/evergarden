import { eq } from "drizzle-orm";

import { type Rendered, RENDERER_VERSION, render } from "#/render";
import { db } from "#/server/db";
import { content } from "#/server/db/schema";

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Rows are keyed by hash, so storing twice is harmless. */
export async function store(sha: string, markdown: string, output: Rendered): Promise<void> {
  const cache = { rendered: await gzip(output), rendererVersion: RENDERER_VERSION };
  await db
    .insert(content)
    .values({ sha256: sha, markdown, ...cache })
    .onConflictDoUpdate({ target: content.sha256, set: cache });
}

export async function source(sha: string): Promise<string> {
  const row = await db
    .select({ markdown: content.markdown })
    .from(content)
    .where(eq(content.sha256, sha))
    .get();
  if (!row) throw new Error(`Missing content ${sha}`);
  return row.markdown;
}

export async function rendered(sha: string): Promise<Rendered> {
  const row = await db.select().from(content).where(eq(content.sha256, sha)).get();
  if (!row) throw new Error(`Missing content ${sha}`);
  if (row.rendered && row.rendererVersion === RENDERER_VERSION) return gunzip(row.rendered);
  const result = await render(row.markdown);
  await db
    .update(content)
    .set({ rendered: await gzip(result), rendererVersion: RENDERER_VERSION })
    .where(eq(content.sha256, sha));
  return result;
}

// The tree is 5 to 10 times the size of its markdown, and gzip brings it back to about the same
// size. That keeps the largest document (512 KB) under D1's 2 MB limit for one value.
async function gzip(value: Rendered): Promise<Buffer> {
  const stream = new Blob([JSON.stringify(value)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return Buffer.from(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Buffer): Promise<Rendered> {
  const stream = new Blob([new Uint8Array(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json<Rendered>();
}
