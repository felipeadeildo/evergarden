import { useLayoutEffect, useRef } from "react";

import { ThreadActions, useComments } from "./comments";
import { Composer, FoldedThread } from "./thread";

const GAP = 10;
const DRAFT = "draft";

/**
 * Notes in the right margin, each level with its passage. When notes would overlap, the open
 * one stays level with its passage and the others move out of its way. Positions come from the
 * page's layout, so they are written to the notes' styles rather than kept in React state.
 */
export function CommentsMargin() {
  const comments = useComments();
  const { open, ranges, active, setActive, draft, setDraft, source, root, wide } = comments;
  const margin = useRef<HTMLDivElement>(null);
  const focused = draft ? DRAFT : active;

  useLayoutEffect(() => {
    const element = margin.current;
    if (!element || !wide) return undefined;
    const ids = [...(draft ? [DRAFT] : []), ...open.map((thread) => thread.id)];
    const notes = ids
      .map((id) => element.querySelector<HTMLElement>(`[data-note="${id}"]`))
      .filter((note) => note !== null);

    function place(container: HTMLElement) {
      const origin = container.getBoundingClientRect().top;
      const found = ranges();
      const placed = notes
        .map((note) => {
          const rect = found.get(note.dataset.note ?? "")?.getClientRects()[0];
          if (!rect) note.style.visibility = "hidden";
          return rect ? { note, top: rect.top - origin, height: note.offsetHeight } : null;
        })
        .filter((item) => item !== null)
        .toSorted((a, b) => a.top - b.top);

      const pivot = Math.max(
        0,
        placed.findIndex((item) => item.note.dataset.note === focused),
      );
      const tops: number[] = [];
      for (let i = pivot, floor = -Infinity; i < placed.length; i++) {
        tops[i] = Math.max(placed[i]!.top, floor);
        floor = tops[i]! + placed[i]!.height + GAP;
      }
      for (let i = pivot - 1, ceiling = tops[pivot] ?? Infinity; i >= 0; i--) {
        tops[i] = Math.min(placed[i]!.top, ceiling - placed[i]!.height - GAP);
        ceiling = tops[i]!;
      }
      placed.forEach((item, i) => {
        item.note.style.top = `${tops[i]}px`;
        item.note.style.visibility = "visible";
      });
    }

    place(element);
    // Text reflows when fonts load, diagrams redraw or the window resizes; notes grow as they open.
    const observer = new ResizeObserver(() => place(element));
    if (root.current) observer.observe(root.current);
    for (const note of notes) observer.observe(note);
    return () => observer.disconnect();
  }, [ranges, focused, draft, open, root, wide]);

  if (!wide) return null;
  return (
    <div ref={margin} className="comments-margin">
      {draft ? (
        <div data-note={DRAFT} className="comments-margin-item">
          <Composer
            passage={source.slice(draft.start, draft.end)}
            onSubmit={async (input) => {
              const id = await comments.comment.mutateAsync({ ...draft, ...input });
              setDraft(null);
              setActive(id);
            }}
            onCancel={() => setDraft(null)}
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
            <FoldedThread thread={thread} onOpen={() => setActive(thread.id)} />
          )}
        </div>
      ))}
    </div>
  );
}
