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
  const container = range.commonAncestorContainer;
  const element = container instanceof Element ? container : container.parentElement;
  const block = element?.closest("[data-sourcepos]");
  const position = block && root.contains(block) ? sourcePosition(block) : null;
  if (!block || !position) return null;

  const nodes = textNodes(block);
  const text = nodes.map((node) => node.data).join("");
  const from = offsetOf(nodes, range.startContainer, range.startOffset);
  const to = offsetOf(nodes, range.endContainer, range.endOffset);
  return to > from ? sourceRange(source, position, text, from, to) : null;
}

/** The DOM range that shows a markdown range, in the innermost block that holds all of it. */
export function domRange(root: Element, source: string, target: SourceRange): Range | null {
  let block: Element | null = null;
  for (const candidate of root.querySelectorAll("[data-sourcepos]")) {
    const position = sourcePosition(candidate);
    if (position && position.start <= target.start && position.end >= target.end) block = candidate;
  }
  const position = block && sourcePosition(block);
  if (!block || !position) return null;

  const nodes = textNodes(block);
  const shown = textRange(source, position, nodes.map((node) => node.data).join(""), target);
  if (!shown) return null;

  const range = document.createRange();
  let total = 0;
  let started = false;
  for (const node of nodes) {
    const next = total + node.data.length;
    if (!started && shown.from < next) {
      range.setStart(node, shown.from - total);
      started = true;
    }
    if (started && shown.to <= next) {
      range.setEnd(node, shown.to - total);
      return range;
    }
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
