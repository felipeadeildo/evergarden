/** Read by the server, which enforces them, and by the page, which says them before an upload. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_FILES_BYTES = 100 * 1024 * 1024;

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  zip: "application/zip",
  gz: "application/gzip",
  mp4: "video/mp4",
};

/**
 * Images the page shows. Everything else, SVG included because it can carry scripts, is only
 * ever downloaded, so no file can run in the library's origin.
 */
const SHOWN = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

/** The type comes from the name alone: what an uploader claims is never trusted. */
export function typeOf(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[extension] ?? "application/octet-stream";
}

export function isShown(type: string): boolean {
  return SHOWN.has(type);
}

/** Letters, digits, spaces, dots, dashes and parentheses; no slashes, no leading dot. */
const NAME = /^[\p{L}\p{N}_][\p{L}\p{N} ._()-]{0,99}$/u;

export function isFileName(name: string): boolean {
  return NAME.test(name) && !name.endsWith(".") && !name.endsWith(" ");
}

export function fileUrl(documentId: string, name: string, version?: number | "draft"): string {
  const query = version === undefined ? "" : `?v=${version}`;
  return `/d/${documentId}/files/${encodeURIComponent(name)}${query}`;
}

const units = ["B", "KB", "MB", "GB"];

export function formatSize(bytes: number): string {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? size : size.toFixed(size < 10 ? 1 : 0)} ${units[unit]}`;
}
