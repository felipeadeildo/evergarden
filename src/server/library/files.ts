import { env } from "cloudflare:workers";

import {
  formatSize,
  isFileName,
  MAX_DOCUMENT_FILES_BYTES,
  MAX_FILE_BYTES,
  typeOf,
} from "#/lib/files";
import type { AttachedFile } from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

import { sha256 } from "./content";
import { changeDraft, type Draft, getDraft } from "./drafts";
import { type Author, getDocument, read } from "./index";

function blobKey(sha: string): string {
  return `blobs/${sha}`;
}

function checkName(name: string): string {
  const clean = name.trim();
  if (!isFileName(clean)) {
    throw new EvergardenError(
      "invalid",
      `"${name}" is not a file name: use letters, digits, spaces, dots, dashes and parentheses, up to 100.`,
    );
  }
  return clean;
}

/** Stores the bytes once, whatever name or document they come under. */
async function storeBlob(bytes: ArrayBuffer, type: string): Promise<string> {
  const sha = await sha256(bytes);
  if (!(await env.FILES.head(blobKey(sha)))) {
    await env.FILES.put(blobKey(sha), bytes, { httpMetadata: { contentType: type } });
  }
  return sha;
}

/**
 * Attaches a file to the document's draft, replacing one with the same name. It reaches readers
 * when the draft is published, as part of the next version.
 */
export async function attachFile(
  id: string,
  name: string,
  bytes: ArrayBuffer,
  author: Author,
): Promise<Draft> {
  const clean = checkName(name);
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new EvergardenError("too_large", `Files are at most ${formatSize(MAX_FILE_BYTES)}.`);
  }
  await getDocument(id);
  const type = typeOf(clean);
  const entry: AttachedFile = {
    name: clean,
    sha256: await storeBlob(bytes, type),
    size: bytes.byteLength,
    type,
  };
  return changeDraft(id, author, 1, (base) => {
    const files = [...base.files.filter((file) => file.name !== clean), entry].toSorted((a, b) =>
      a.name.localeCompare(b.name),
    );
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_DOCUMENT_FILES_BYTES) {
      throw new EvergardenError(
        "too_large",
        `A document holds at most ${formatSize(MAX_DOCUMENT_FILES_BYTES)} of files.`,
      );
    }
    return { markdown: base.markdown, files };
  });
}

export function detachFile(id: string, name: string, author: Author): Promise<Draft> {
  return changeDraft(id, author, 1, (base) => {
    if (!base.files.some((file) => file.name === name)) throw noFile(name);
    return { markdown: base.markdown, files: base.files.filter((file) => file.name !== name) };
  });
}

/** A file as one version has it, or as the draft has it. */
export async function openFile(
  id: string,
  name: string,
  version: number | "draft" | undefined,
): Promise<{ file: AttachedFile; body: ReadableStream }> {
  const files = version === "draft" ? (await getDraft(id))?.files : (await read(id, version)).files;
  const file = files?.find((entry) => entry.name === name);
  const object = file ? await env.FILES.get(blobKey(file.sha256)) : null;
  if (!file || !object) throw noFile(name);
  return { file, body: object.body };
}

function noFile(name: string) {
  return new EvergardenError("not_found", `The document has no file named "${name}".`);
}
