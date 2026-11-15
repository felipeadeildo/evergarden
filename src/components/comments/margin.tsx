import { useLayoutEffect, useRef } from "react";

import { Manicule } from "#/components/ui/wordmark";

import { DRAFT, SELECTION, ThreadActions, useComments } from "./comments";
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
  const { open, ranges, active, setActive, setHovered, selection, draft, startDraft } = comments;
  const { cancelDraft, source, root, wide } = comments;
  const margin = useRef<HTMLDivElement>(null);
  const leader = useRef<SVGPathElement>(null);
  const focused = draft ? DRAFT : active;
  const gutterButton = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const element = margin.current;
    if (!element || !wide) return undefined;
    const ids = [DRAFT, ...open.map((thread) => thread.id)];
    const notes = ids
      .map((id) => element.querySelector<HTMLElement>(`[data-note="${id}"]`))
      .filter((note) => note !== null);

    function place(container: HTMLElement) {
      const origin = container.getBoundingClientRect();
      const found = ranges();
      const placed = notes
        .map((note) => {
          const rect = found.get(note.dataset.note ?? "")?.getClientRects()[0];
          if (!rect) note.style.visibility = "hidden";
          return rect
            ? { note, line: rect.top - origin.top, middle: rect.top + rect.height / 2 - origin.top }
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

      const textEdge = (root.current?.getBoundingClientRect().right ?? origin.left) - origin.left;
      const target = placed[pivot];
      const rects = target
        ? found.get(target.note.dataset.note ?? "")?.getClientRects()
        : undefined;
      // A passage that wraps runs to the end of its first line, so the leader can start at it.
      const from = rects && rects.length > 1 ? rects[0]!.right - origin.left : textEdge;
      drawLeader(
        leader.current,
        target && target.note.dataset.note === focused
          ? { from, y: target.middle, to: tops[pivot]! + 14 }
          : null,
      );

      // The Comment button sits in the gutter beside the selection, out of the notes' way.
      const button = gutterButton.current;
      const selected = found.get(SELECTION)?.getClientRects()[0];
      if (button && selected) {
        button.style.top = `${selected.top + selected.height / 2 - origin.top}px`;
        button.style.left = `${textEdge / 2}px`;
      }
    }

    place(element);
    // Text reflows when fonts load, diagrams redraw or the window resizes; notes grow as they open.
    const observer = new ResizeObserver(() => place(element));
    if (root.current) observer.observe(root.current);
    for (const note of notes) observer.observe(note);
    return () => observer.disconnect();
  }, [ranges, focused, open, root, wide]);

  if (!wide) return null;
  return (
    <div ref={margin} className="comments-margin">
      <svg className="comments-leader" aria-hidden focusable={false}>
        <path ref={leader} />
      </svg>
      {selection && !draft ? (
        <button
          ref={gutterButton}
          type="button"
          className="gutter-comment"
          aria-label="Comment"
          title="Comment (⌘⌥M)"
          // Keeps the selection alive until the click lands.
          onPointerDown={(event) => event.preventDefault()}
          onClick={startDraft}
        >
          <Manicule className="manicule" pointing="left" />
        </button>
      ) : null}
      {draft ? (
        <div data-note={DRAFT} className="comments-margin-item">
          <Composer
            passage={source.slice(draft.start, draft.end)}
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
