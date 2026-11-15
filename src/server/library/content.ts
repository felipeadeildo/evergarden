import { eq } from "drizzle-orm";

import { type Rendered, RENDERER_VERSION, render } from "#/render";
import { db } from "#/server/db";
import { content } from "#/server/db/schema";

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
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

/** The rendered tree from its cache, rendering it again (and caching it) after a renderer change. */
export async function cachedRender(
  sha: string,
  markdown: string,
  cache: { rendered: Buffer | null; rendererVersion: number | null },
): Promise<Rendered> {
  if (cache.rendered && cache.rendererVersion === RENDERER_VERSION) return gunzip(cache.rendered);
  const result = await render(markdown);
  await db
    .update(content)
    .set({ rendered: await gzip(result), rendererVersion: RENDERER_VERSION })
    .where(eq(content.sha256, sha));
  return result;
}

export async function rendered(sha: string): Promise<Rendered> {
  const row = await db.select().from(content).where(eq(content.sha256, sha)).get();
  if (!row) throw new Error(`Missing content ${sha}`);
  return cachedRender(sha, row.markdown, row);
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
