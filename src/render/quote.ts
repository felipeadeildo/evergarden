import type { Nodes } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import type { Quote } from "#/anchor";

/** A run of a quoted passage as the reader saw it: plain text, or inline code. */
export type Piece = { text: string; code?: true };

const BLOCKS = new Set(["paragraph", "heading", "listItem", "tableCell", "blockquote", "code"]);
const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * The text a reader saw for a quoted passage, without its markdown. The passage is parsed with
 * the text around it, so markup that opens before it (`**` started outside a selection) is read
 * as markup rather than shown.
 */
export function quoteText({
  prefix,
  exact,
  suffix,
}: Pick<Quote, "prefix" | "exact" | "suffix">): Piece[] {
  const source = prefix + exact + suffix;
  const from = prefix.length;
  const to = from + exact.length;
  const pieces: Piece[] = [];

  function walk(node: Nodes) {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? 0;
    if (end <= from || start >= to) return;
    if ("value" in node && (node.type === "text" || node.type === "inlineCode")) {
      const text = clip(node.value, source.indexOf(node.value, start), end);
      if (text) pieces.push(node.type === "inlineCode" ? { text, code: true } : { text });
      return;
    }
    if ("children" in node) for (const child of node.children) walk(child);
    if (BLOCKS.has(node.type)) pieces.push({ text: " " });
  }

  /** The part of `value`, found at `at` in the source, that lies inside the passage. */
  function clip(value: string, at: number, end: number): string {
    // Escapes and entities make the value differ from its source; keep such a node whole.
    if (at === -1 || at + value.length > end) return value;
    return value.slice(Math.max(0, from - at), Math.max(0, to - at));
  }

  walk(parser.parse(source));
  return tidy(pieces);
}

/** Joins neighbouring text, folds whitespace and drops a callout's `[!NOTE]` marker. */
function tidy(pieces: Piece[]): Piece[] {
  const joined: Piece[] = [];
  for (const piece of pieces) {
    const last = joined.at(-1);
    if (!piece.code && last && !last.code) last.text += piece.text;
    else joined.push({ ...piece });
  }
  for (const piece of joined) piece.text = piece.text.replaceAll(/\s+/g, " ");
  const first = joined[0];
  if (first && !first.code) first.text = first.text.replace(/^\s*\[!\w+\]\s*/, "").trimStart();
  const last = joined.at(-1);
  if (last && !last.code) last.text = last.text.trimEnd();
  return joined.filter((piece) => piece.text);
}
