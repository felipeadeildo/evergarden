import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Manicule } from "#/components/ui/wordmark";

import { DRAFT, SELECTION, ThreadActions, useComments } from "./comments";
import { sourcePosition } from "./dom";
import { BLOCKS, FIGURES, lineOf, pinArea } from "./places";
import { Composer, FoldedThread } from "./thread";

const GAP = 12;
// Notes on the same line of text touch, so their rules read as one group.
const GROUPED_GAP = 0;

/**
 * Notes in the right margin, each level with its passage. When notes would overlap, the one in
 * focus stays level with its passage and the others move out of its way; a leader runs from the
 * passage's line to the note in focus. Positions come from the page's layout, so they are written
 * to the elements' styles rather than kept in React state.
 */
export function CommentsMargin() {
  const comments = useComments();
  const { open, ranges, places, active, setActive, setHovered, selection, draft } = comments;
  const { startDraft, cancelDraft, source, root, wide } = comments;
  const margin = useRef<HTMLDivElement>(null);
  const leader = useRef<SVGPathElement>(null);
  const focused = draft ? DRAFT : active;
  const gutterButton = useRef<HTMLButtonElement>(null);
  const block = useHoveredBlock(root, Boolean(selection || draft));
  const [pinning, setPinning] = useState<HTMLElement | null>(null);
  usePinning(pinning, setPinning, startDraft);

  useLayoutEffect(() => {
    const element = margin.current;
    if (!element || !wide) return undefined;
    const ids = [DRAFT, ...open.map((thread) => thread.id)];
    const notes = ids
      .map((id) => element.querySelector<HTMLElement>(`[data-note="${id}"]`))
      .filter((note) => note !== null);

    function place(container: HTMLElement) {
      const origin = container.getBoundingClientRect();
      const found = places();
      const columnEdge = root.current?.getBoundingClientRect().right ?? origin.left;
      const placed = notes
        .map((note) => {
          const spot = found.get(note.dataset.note ?? "");
          const line = spot && lineOf(spot, columnEdge);
          if (!line) note.style.visibility = "hidden";
          return line
            ? {
                note,
                line: line.top - origin.top,
                middle: line.middle - origin.top,
                from: line.from - origin.left,
              }
            : null;
        })
        .filter((item) => item !== null)
        .toSorted((a, b) => a.line - b.line);

      // Top to bottom, each note at its line or just below the one before it.
      const tops: number[] = [];
      for (let i = 0, floor = -Infinity; i < placed.length; i++) {
        tops[i] = Math.max(placed[i]!.line, floor);
        floor = tops[i]! + placed[i]!.note.offsetHeight + gapAfter(placed, i);
      }
      // The note in focus goes back to its line; only the notes in its way move.
      const pivot = Math.max(
        0,
        placed.findIndex((item) => item.note.dataset.note === focused),
      );
      if (placed[pivot] && tops[pivot] !== placed[pivot].line) {
        for (let i = pivot, floor = -Infinity; i < placed.length; i++) {
          tops[i] = Math.max(placed[i]!.line, floor);
          floor = tops[i]! + placed[i]!.note.offsetHeight + gapAfter(placed, i);
        }
        for (let i = pivot - 1, ceiling = tops[pivot]!; i >= 0; i--) {
          tops[i] = Math.min(
            tops[i]!,
            ceiling - placed[i]!.note.offsetHeight - gapAfter(placed, i),
          );
          ceiling = tops[i]!;
        }
      }
      placed.forEach((item, i) => {
        item.note.style.top = `${tops[i]}px`;
        item.note.style.visibility = "visible";
      });

      const textEdge = columnEdge - origin.left;
      const target = placed[pivot];
      drawLeader(
        leader.current,
        target && target.note.dataset.note === focused
          ? { from: target.from, y: target.middle, to: tops[pivot]! + 14 }
          : null,
      );

      // The Comment button sits in the gutter beside the selection or the block under the pointer.
      const button = gutterButton.current;
      const beside = ranges().get(SELECTION)?.getClientRects()[0] ?? block?.getBoundingClientRect();
      if (button && beside) {
        const y = Math.min(beside.top + beside.height / 2, beside.top + 16);
        button.style.top = `${y - origin.top}px`;
        button.style.left = `${textEdge / 2}px`;
      }
    }

    place(element);
    // Text reflows when fonts load, diagrams redraw or the window resizes; notes grow as they open.
    const observer = new ResizeObserver(() => place(element));
    if (root.current) observer.observe(root.current);
    for (const note of notes) observer.observe(note);
    return () => observer.disconnect();
  }, [ranges, places, focused, open, root, wide, block]);

  if (!wide) return null;
  return (
    <div ref={margin} className="comments-margin">
      <svg className="comments-leader" aria-hidden focusable={false}>
        <path ref={leader} />
      </svg>
      {(selection || block) && !draft ? (
        <button
          ref={gutterButton}
          type="button"
          className="gutter-comment"
          aria-label={commentLabel(selection !== null, block)}
          title={selection ? "Comment (⌘⌥M)" : commentLabel(false, block)}
          aria-pressed={pinning ? true : undefined}
          // Keeps the selection alive until the click lands.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            if (selection) startDraft();
            else if (block?.matches(FIGURES)) setPinning(pinning ? null : block);
            else if (block) {
              const range = sourcePosition(block.querySelector("table") ?? block);
              if (range) startDraft({ kind: "block", ...range });
            }
          }}
        >
          <Manicule className="manicule" pointing="left" />
        </button>
      ) : null}
      {draft ? (
        <div data-note={DRAFT} className="comments-margin-item">
          <Composer
            passage={source.slice(draft.start, draft.end)}
            canSuggest={draft.kind === "text"}
            onSubmit={async (input) => {
              const id = await comments.comment.mutateAsync({ ...draft, ...input });
              cancelDraft();
              setActive(id);
            }}
            onCancel={cancelDraft}
          />
        </div>
      ) : null}
      {open.map((thread) => (
        <div
          key={thread.id}
          data-note={thread.id}
          className="comments-margin-item"
          data-active={thread.id === focused || undefined}
        >
          {thread.id === focused ? (
            <ThreadActions thread={thread} />
          ) : (
            <FoldedThread
              thread={thread}
              onOpen={() => setActive(thread.id)}
              onHover={(hovered) => setHovered(hovered ? thread.id : null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function gapAfter(placed: { line: number }[], i: number): number {
  const next = placed[i + 1];
  return next && Math.abs(next.line - placed[i]!.line) < 2 ? GROUPED_GAP : GAP;
}

/**
 * A hairline from the text column's edge, level with the passage, to the note in focus: across
 * the gutter, then down (or up) to the note's first line when the note had to move.
 */
function drawLeader(
  path: SVGPathElement | null,
  points: { from: number; y: number; to: number } | null,
) {
  if (!path) return;
  if (!points) {
    path.setAttribute("d", "");
    return;
  }
  const { from, y, to } = points;
  const bend = -10;
  path.setAttribute("d", `M ${from + 6} ${y} H ${bend} V ${to} H -2`);
}

function commentLabel(selected: boolean, block: HTMLElement | null): string {
  if (selected || !block) return "Comment";
  return block.matches(FIGURES) ? "Comment on a point in this figure" : "Comment on this block";
}

/**
 * The block under the pointer, for the gutter's Comment button. It stays after the pointer leaves
 * the text for the gutter, so the button can be reached; a selection takes its place.
 */
function useHoveredBlock(
  root: React.RefObject<HTMLElement | null>,
  busy: boolean,
): HTMLElement | null {
  const [block, setBlock] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    function over(event: PointerEvent) {
      const found =
        event.target instanceof Element ? event.target.closest<HTMLElement>(BLOCKS) : null;
      setBlock(found && element!.contains(found) ? found : null);
    }
    element.addEventListener("pointerover", over);
    return () => element.removeEventListener("pointerover", over);
  }, [root]);
  return busy ? null : block;
}

/**
 * While `figure` is set, the next click inside its drawing starts a comment on that spot.
 * `Esc` or a click outside cancels.
 */
function usePinning(
  figure: HTMLElement | null,
  setFigure: (figure: HTMLElement | null) => void,
  startDraft: ReturnType<typeof useComments>["startDraft"],
) {
  useEffect(() => {
    if (!figure) return undefined;
    const area = pinArea(figure);
    figure.setAttribute("data-pinning", "");
    function click(event: MouseEvent) {
      if (!(event.target instanceof Node) || !area.contains(event.target)) {
        setFigure(null);
        return;
      }
      // The click places the pin; it must not also open the diagram full screen.
      event.preventDefault();
      event.stopPropagation();
      const box = area.getBoundingClientRect();
      const range = sourcePosition(figure!);
      if (range) {
        startDraft({
          kind: "point",
          ...range,
          x: (event.clientX - box.left) / box.width,
          y: (event.clientY - box.top) / box.height,
        });
      }
      setFigure(null);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setFigure(null);
    }
    window.addEventListener("click", click, true);
    window.addEventListener("keydown", key);
    return () => {
      figure.removeAttribute("data-pinning");
      window.removeEventListener("click", click, true);
      window.removeEventListener("keydown", key);
    };
  }, [figure, setFigure, startDraft]);
}
