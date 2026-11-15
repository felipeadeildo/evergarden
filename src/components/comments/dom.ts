import { type Range as SourceRange, sourceRange, textRange } from "#/anchor";

// Text a reader cannot select as prose: the § links, controls, a diagram's drawing and hidden
// source, and KaTeX's duplicate copy of each formula.
const SKIP = ".heading-link, button, svg, [hidden], .katex";

function textNodes(block: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text && !node.parentElement?.closest(SKIP)) nodes.push(node);
  }
  return nodes;
}

export function sourcePosition(block: Element): SourceRange | null {
  const [start, end] = (block.getAttribute("data-sourcepos") ?? "").split("-").map(Number);
  return start === undefined || end === undefined || Number.isNaN(start + end)
    ? null
    : { start, end };
}

/** Characters of `nodes` before a DOM boundary point. */
function offsetOf(nodes: Text[], container: Node, offset: number): number {
  const boundary = document.createRange();
  boundary.setStart(container, offset);
  let total = 0;
  for (const node of nodes) {
    if (node === container) return total + offset;
    if (boundary.comparePoint(node, 0) > 0) return total;
    total += node.data.length;
  }
  return total;
}

/** The markdown range behind the reader's selection, when it lies inside `root`. */
export function selectedSource(root: Element, source: string): SourceRange | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const shared = blockOf(root, range.commonAncestorContainer);
  if (shared) {
    const from = sourceAt(source, shared, range.startContainer, range.startOffset, "start");
    const to = sourceAt(source, shared, range.endContainer, range.endOffset, "end");
    return from !== null && to !== null && to > from ? { start: from, end: to } : null;
  }
  // A selection across paragraphs: from where it starts in the first to where it ends in the last.
  const first = blockOf(root, range.startContainer);
  const last = blockOf(root, range.endContainer);
  const from = first && sourceAt(source, first, range.startContainer, range.startOffset, "start");
  const to = last && sourceAt(source, last, range.endContainer, range.endOffset, "end");
  return typeof from === "number" && typeof to === "number" && to > from
    ? { start: from, end: to }
    : null;
}

function blockOf(root: Element, node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  const block = element?.closest("[data-sourcepos]");
  return block && root.contains(block) ? block : null;
}

/** The markdown offset of a DOM point inside `block`, as the start or the end of a range. */
function sourceAt(
  source: string,
  block: Element,
  container: Node,
  offset: number,
  edge: "start" | "end",
): number | null {
  const position = sourcePosition(block);
  if (!position) return null;
  const nodes = textNodes(block);
  const text = nodes.map((node) => node.data).join("");
  const at = offsetOf(nodes, container, offset);
  const range =
    edge === "start"
      ? sourceRange(source, position, text, at, text.length)
      : sourceRange(source, position, text, 0, at);
  if (!range) return null;
  return edge === "start" ? range.start : range.end;
}

/**
 * The DOM range that shows a markdown range: inside the innermost block that holds all of it, or
 * from the block where it starts to the block where it ends.
 */
export function domRange(root: Element, source: string, target: SourceRange): Range | null {
  const holding = innermost(
    root,
    (block) => block.start <= target.start && block.end >= target.end,
  );
  const first =
    holding ?? innermost(root, (block) => block.start <= target.start && block.end > target.start);
  const last =
    holding ?? innermost(root, (block) => block.start < target.end && block.end >= target.end);
  const start = first && pointAt(source, first, target, "start");
  const end = last && pointAt(source, last, target, "end");
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

/** The last match in document order, which is the innermost, as blocks nest. */
function innermost(root: Element, test: (block: SourceRange) => boolean): Element | null {
  let found: Element | null = null;
  for (const candidate of root.querySelectorAll("[data-sourcepos]")) {
    const position = sourcePosition(candidate);
    if (position && test(position)) found = candidate;
  }
  return found;
}

/** Where the part of `target` inside `block` starts or ends, as a text node and an offset. */
function pointAt(
  source: string,
  block: Element,
  target: SourceRange,
  edge: "start" | "end",
): { node: Text; offset: number } | null {
  const position = sourcePosition(block);
  if (!position) return null;
  const nodes = textNodes(block);
  const inside = {
    start: Math.max(target.start, position.start),
    end: Math.min(target.end, position.end),
  };
  const shown = textRange(source, position, nodes.map((node) => node.data).join(""), inside);
  if (!shown) return null;
  const index = edge === "start" ? shown.from : shown.to;
  let total = 0;
  for (const node of nodes) {
    const next = total + node.data.length;
    if (edge === "start" ? index < next : index <= next) return { node, offset: index - total };
    total = next;
  }
  return null;
}

/** The block a block or point comment is on: the element whose source is exactly that range. */
export function blockElement(root: Element, target: SourceRange): HTMLElement | null {
  for (const candidate of root.querySelectorAll<HTMLElement>("[data-sourcepos]")) {
    const position = sourcePosition(candidate);
    if (position?.start === target.start && position.end === target.end) return candidate;
  }
  return null;
}

/** The block of `element` that takes whole-block comments: a table, code, a callout or a figure. */
export const COMMENTABLE_BLOCK = ".prose > table, .prose > figure, .prose > aside, .prose > pre";
