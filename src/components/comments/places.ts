import type { Range as SourceRange } from "#/anchor";

import { blockElement, domRange } from "./dom";
import type { Target } from "./use-threads";

/** Where a comment sits in the page: a passage of text, a whole block, or a spot in a figure. */
export type Place =
  | { kind: "text"; range: Range }
  | { kind: "block"; element: HTMLElement }
  | { kind: "point"; element: HTMLElement; x: number; y: number };

/** Blocks that take a comment as a whole: tables, code, callouts and figures. */
export const BLOCKS = ".table-scroll, figure[data-sourcepos], aside.callout[data-sourcepos]";

/** Figures whose comments point at a spot inside them. */
export const FIGURES = "figure[data-kind='diagram']";

export function placeOf(root: Element, source: string, target: Target): Place | null {
  if (target.kind === "text") {
    const range = domRange(root, source, target);
    return range && { kind: "text", range };
  }
  const element = blockElement(root, target);
  if (!element) return null;
  const shown = element.closest<HTMLElement>(".table-scroll") ?? element;
  return target.kind === "point"
    ? { kind: "point", element: shown, x: target.x, y: target.y }
    : { kind: "block", element: shown };
}

/** The part of a figure a point is measured against: the drawing, not its frame. */
export function pinArea(figure: HTMLElement): HTMLElement {
  return figure.querySelector<HTMLElement>(".diagram") ?? figure;
}

/** The spot a point comment marks, in viewport coordinates. */
export function pinAt(place: Extract<Place, { kind: "point" }>): { x: number; y: number } {
  const box = pinArea(place.element).getBoundingClientRect();
  return { x: box.left + box.width * place.x, y: box.top + box.height * place.y };
}

/** The line a margin note sits level with, and where its leader leaves the page. */
export function lineOf(
  place: Place,
  columnEdge: number,
): { top: number; middle: number; from: number } | null {
  // The pin marks the spot, so the leader stays off the drawing and leaves from the column's edge.
  if (place.kind === "point") {
    const pin = pinAt(place);
    return { top: pin.y - 14, middle: pin.y, from: columnEdge };
  }
  if (place.kind === "block") {
    const box = place.element.getBoundingClientRect();
    return { top: box.top, middle: box.top + 14, from: columnEdge };
  }
  const rects = [...place.range.getClientRects()];
  const first = rects[0];
  if (!first) return null;
  // A passage that wraps runs to the end of its first line, so the leader starts there; one that
  // ends mid-line starts at the column's edge, clear of the text after it. A line splits into
  // several boxes around links and bold, so its end is the box that reaches furthest right.
  const firstLine = rects.filter((rect) => Math.abs(rect.top - first.top) < 2);
  const from =
    firstLine.length === rects.length
      ? columnEdge
      : Math.max(...firstLine.map((rect) => rect.right));
  return { top: first.top, middle: first.top + first.height / 2, from };
}

export function scrollToPlace(place: Place): void {
  const element = place.kind === "text" ? place.range.startContainer.parentElement : place.element;
  element?.scrollIntoView({ block: "center" });
}

export function sourceTarget(range: SourceRange): Target {
  return { kind: "text", ...range };
}
