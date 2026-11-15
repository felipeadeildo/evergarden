export type Range = { start: number; end: number };

/** A passage of markdown, with the text around it to find it again after the text changes. */
export type Quote = Range & { exact: string; prefix: string; suffix: string };

const CONTEXT = 32;
// How far past markup (`**`, `[`, a link's URL) a rendered character may sit in the source.
const LOOKAHEAD = 400;

export function quote(source: string, start: number, end: number): Quote {
  return {
    start,
    end,
    exact: source.slice(start, end),
    prefix: source.slice(Math.max(0, start - CONTEXT), start),
    suffix: source.slice(end, end + CONTEXT),
  };
}

/**
 * The source offset of each character of `text`, the rendered text of `source`, or -1 when it
 * has none. Markup has no rendered character, so it is skipped; whitespace runs match each other.
 */
export function align(source: string, text: string): number[] {
  const offsets: number[] = [];
  let at = 0;
  // Indexed by UTF-16 unit, as the browser counts selection offsets.
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (/\s/.test(char)) {
      offsets.push(/\s/.test(source[at] ?? "") ? at : -1);
      while (/\s/.test(source[at] ?? "")) at++;
      continue;
    }
    const found = source.indexOf(char, at);
    if (found === -1 || found - at > LOOKAHEAD) {
      offsets.push(-1);
      continue;
    }
    offsets.push(found);
    at = found + 1;
  }
  return offsets;
}

/** The markdown behind characters `from` to `to` of a block's rendered text. */
export function sourceRange(
  source: string,
  block: Range,
  text: string,
  from: number,
  to: number,
): Range | null {
  const offsets = align(source.slice(block.start, block.end), text).slice(from, to);
  const first = offsets.find((offset) => offset >= 0);
  const last = offsets.findLast((offset) => offset >= 0);
  if (first === undefined || last === undefined) return null;
  return { start: block.start + first, end: block.start + last + 1 };
}

/** The characters of a block's rendered text that show the markdown in `range`. */
export function textRange(
  source: string,
  block: Range,
  text: string,
  range: Range,
): { from: number; to: number } | null {
  const offsets = align(source.slice(block.start, block.end), text);
  const start = range.start - block.start;
  const end = range.end - block.start;
  const from = offsets.findIndex((offset) => offset >= start && offset < end);
  const to = offsets.findLastIndex((offset) => offset >= start && offset < end);
  if (from === -1 || to === -1) return null;
  return { from, to: to + 1 };
}

/**
 * The same passage in a new version of the source, or null when it is gone. A passage that
 * appears more than once goes to the copy whose surrounding text matches best.
 */
export function relocate(passage: Quote, source: string): Quote | null {
  if (!passage.exact) return null;
  if (source.slice(passage.start, passage.end) === passage.exact) {
    return quote(source, passage.start, passage.end);
  }
  const exact = matches(source, passage.exact);
  const candidates = exact.length > 0 ? exact : loose(source, passage.exact);
  const best = candidates.toSorted(
    (a, b) =>
      fit(source, b, passage) - fit(source, a, passage) ||
      Math.abs(a.start - passage.start) - Math.abs(b.start - passage.start),
  )[0];
  return best ? quote(source, best.start, best.end) : null;
}

function matches(source: string, exact: string): Range[] {
  const found: Range[] = [];
  for (let at = source.indexOf(exact); at !== -1; at = source.indexOf(exact, at + 1)) {
    found.push({ start: at, end: at + exact.length });
  }
  return found;
}

/** Matches that differ only in whitespace, such as a paragraph the agent rewrapped. */
function loose(source: string, exact: string): Range[] {
  const words = exact.trim().split(/\s+/).map(escape);
  const pattern = new RegExp(words.join("\\s+"), "g");
  return [...source.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** How many characters of context agree on either side of a candidate. */
function fit(source: string, range: Range, passage: Quote): number {
  const before = source.slice(Math.max(0, range.start - CONTEXT), range.start);
  const after = source.slice(range.end, range.end + CONTEXT);
  return commonSuffix(before, passage.prefix) + commonPrefix(after, passage.suffix);
}

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
