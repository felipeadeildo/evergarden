import { env } from "cloudflare:workers";

import { type Rendered, RENDERER_VERSION, render } from "#/render";

export async function sha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function blobKey(sha: string): string {
  return `blobs/${sha}.md`;
}

function renderKey(sha: string): string {
  return `render/${sha}@${RENDERER_VERSION}.json`;
}

/** Stores the source and its rendered tree. Both keys are content-addressed, so rewriting is harmless. */
export async function store(sha: string, markdown: string, output: Rendered): Promise<void> {
  await Promise.all([
    env.CONTENT.put(blobKey(sha), markdown, {
      httpMetadata: { contentType: "text/markdown; charset=utf-8" },
    }),
    env.CONTENT.put(renderKey(sha), JSON.stringify(output), {
      httpMetadata: { contentType: "application/json" },
    }),
  ]);
}

export async function source(sha: string): Promise<string> {
  const object = await env.CONTENT.get(blobKey(sha));
  if (!object) throw new Error(`Missing content blob ${sha}`);
  return object.text();
}

/** The rendered tree, from the cache when this renderer version already produced it. */
export async function rendered(sha: string): Promise<Rendered> {
  const cached = await env.CONTENT.get(renderKey(sha));
  if (cached) return cached.json<Rendered>();
  const result = await render(await source(sha));
  await env.CONTENT.put(renderKey(sha), JSON.stringify(result), {
    httpMetadata: { contentType: "application/json" },
  });
  return result;
}
