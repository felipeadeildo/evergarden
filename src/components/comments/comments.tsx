import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { Range as SourceRange } from "#/anchor";
import { BackIcon, CommentIcon, ForwardIcon, OpenMenuIcon } from "#/components/ui/icons";
import { Sheet } from "#/components/ui/sheet";
import { Manicule } from "#/components/ui/wordmark";

import { domRange, selectedSource } from "./dom";
import { type Place, placeOf, scrollToPlace } from "./places";
import { Composer, OpenThread, Passage } from "./thread";
import { type Target, type Thread, useThreads } from "./use-threads";

/** Keys for the two passages that are not threads yet, in `ranges()`. */
export const DRAFT = "draft";
export const SELECTION = "selection";

type Comments = ReturnType<typeof useThreads> & {
  source: string;
  root: RefObject<HTMLElement | null>;
  /**
   * Threads in the margin, in the order of their passages: the open ones on the current version,
   * the resolved ones on an older version, and whichever the reader opened from the versions menu.
   */
  shown: Thread[];
  /** The text passages of shown threads, the new comment and the selection, as DOM ranges. */
  ranges: () => Map<string, Range>;
  /** Where each shown thread and the new comment sit in the page right now, whatever their kind. */
  places: () => Map<string, Place>;
  active: string | null;
  setActive: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  /** The passage the reader selected, before they chose to comment on it. */
  selection: SourceRange | null;
  /** What the comment being written points at. */
  draft: Target | null;
  /** Starts a comment on `target`, or on the selected passage. */
  startDraft: (target?: Target) => void;
  cancelDraft: () => void;
  wide: boolean;
  /** Whether the reader may resolve comments and accept suggestions: the owner, not a guest. */
  moderate: boolean;
  /** Whether new comments can be written: only on the current version. */
  writable: boolean;
};

const CommentsContext = createContext<Comments | null>(null);

export function useComments(): Comments {
  const comments = useMaybeComments();
  if (!comments) throw new Error("useComments needs a CommentsProvider");
  return comments;
}

/** The comments, where the page shows them; null for a reader who cannot see them. */
export function useMaybeComments(): Comments | null {
  return useContext(CommentsContext);
}

export function CommentsProvider({
  documentId,
  version,
  source,
  root,
  active,
  setActive,
  moderate,
  writable,
  children,
}: {
  documentId: string;
  version: number;
  writable: boolean;
  source: string;
  root: RefObject<HTMLElement | null>;
  active: string | null;
  setActive: (id: string | null) => void;
  moderate: boolean;
  children: ReactNode;
}) {
  const data = useThreads(documentId, version);
  const [draft, setDraft] = useState<Target | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const selection = useSelection(root, source);
  const wide = useMediaQuery("(min-width: 1200px)");

  // Each version keeps the comments resolved on it; the current one shows only what is still open.
  const wanted = writable ? "open" : "resolved";
  const shown = useMemo(
    () =>
      data.threads
        .filter(
          (thread) =>
            thread.version === version && (thread.status === wanted || thread.id === active),
        )
        .toSorted((a, b) => a.anchor.start - b.anchor.start || b.anchor.end - a.anchor.end),
    [data.threads, version, wanted, active],
  );

  const targets = useMemo(() => {
    const all = new Map<string, Target>(shown.map((thread) => [thread.id, thread.anchor]));
    if (draft) all.set(DRAFT, draft);
    return all;
  }, [shown, draft]);

  const places = useCallback(() => {
    const found = new Map<string, Place>();
    const element = root.current;
    if (!element) return found;
    for (const [id, target] of targets) {
      const place = placeOf(element, source, target);
      if (place) found.set(id, place);
    }
    return found;
  }, [root, source, targets]);

  const ranges = useCallback(() => {
    const found = new Map<string, Range>();
    for (const [id, place] of places()) if (place.kind === "text") found.set(id, place.range);
    const element = root.current;
    const selected = element && !draft && selection && domRange(element, source, selection);
    if (selected) found.set(SELECTION, selected);
    return found;
  }, [places, root, source, draft, selection]);

  const startDraft = useCallback(
    (target?: Target) => {
      const chosen = target ?? (selection && { kind: "text" as const, ...selection });
      if (!chosen || !writable) return;
      setActive(null);
      setDraft(chosen);
      window.getSelection()?.removeAllRanges();
    },
    [selection, setActive, writable],
  );
  const cancelDraft = useCallback(() => setDraft(null), []);

  const focus = draft ? DRAFT : active;
  useHighlights(ranges, focus, hovered);
  useBlockMarks(places, focus, hovered);
  useClickToOpen(root, ranges, setActive);
  useKeys(shown, places, active, setActive, startDraft);

  const value = useMemo(
    () => ({
      ...data,
      source,
      root,
      shown,
      ranges,
      places,
      active,
      setActive,
      setHovered,
      selection,
      draft,
      startDraft,
      cancelDraft,
      wide,
      moderate,
      writable,
    }),
    [
      data,
      source,
      root,
      shown,
      ranges,
      places,
      active,
      setActive,
      selection,
      draft,
      startDraft,
      cancelDraft,
      wide,
      moderate,
      writable,
    ],
  );
  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>;
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (change) => {
      const list = matchMedia(query);
      list.addEventListener("change", change);
      return () => list.removeEventListener("change", change);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** The markdown range the reader has selected in the document, if any. */
function useSelection(root: RefObject<HTMLElement | null>, source: string): SourceRange | null {
  const [selection, setSelection] = useState<SourceRange | null>(null);
  useEffect(() => {
    let frame = 0;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = root.current ? selectedSource(root.current, source) : null;
        setSelection((current) =>
          current?.start === next?.start && current?.end === next?.end ? current : next,
        );
      });
    }
    document.addEventListener("selectionchange", update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", update);
    };
  }, [root, source]);
  return selection;
}

/** Marks passages with the CSS Custom Highlight API, which paints text without touching the DOM. */
function useHighlights(
  ranges: () => Map<string, Range>,
  active: string | null,
  hovered: string | null,
) {
  useEffect(() => {
    if (typeof CSS === "undefined" || !("highlights" in CSS)) return undefined;
    const found = ranges();
    const strong = new Set([active, hovered]);
    const marked = [...found].filter(([id]) => id !== SELECTION);
    // A highlight paints only over glyphs, which leaves gaps at inline code's padding. Code that
    // sits wholly inside a passage is left out of the highlight and tints its own box instead.
    const codes: HTMLElement[] = [];
    const paint = (name: string, entries: typeof marked, mark: string) => {
      const pieces: AbstractRange[] = [];
      for (const [, range] of entries) {
        const inside = inlineCodeIn(range);
        for (const code of inside) {
          code.dataset.marked = mark;
          codes.push(code);
        }
        pieces.push(...around(range, inside));
      }
      CSS.highlights.set(name, new Highlight(...pieces));
    };
    paint(
      "comment",
      marked.filter(([id]) => !strong.has(id)),
      "",
    );
    paint(
      "comment-active",
      marked.filter(([id]) => strong.has(id)),
      "strong",
    );
    return () => {
      CSS.highlights.delete("comment");
      CSS.highlights.delete("comment-active");
      for (const code of codes) delete code.dataset.marked;
    };
  }, [ranges, active, hovered]);
}

/** Inline code elements that lie wholly inside `range`. */
function inlineCodeIn(range: Range): HTMLElement[] {
  const scope = range.commonAncestorContainer;
  const root = scope instanceof Element ? scope : scope.parentElement;
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(":not(pre) > code")].filter((code) => {
    const whole = document.createRange();
    whole.selectNodeContents(code);
    return (
      range.compareBoundaryPoints(Range.START_TO_START, whole) <= 0 &&
      range.compareBoundaryPoints(Range.END_TO_END, whole) >= 0
    );
  });
}

/** `range` split around `holes`, which lie inside it in document order. */
function around(range: Range, holes: HTMLElement[]): Range[] {
  const pieces: Range[] = [];
  let piece = range.cloneRange();
  for (const hole of holes) {
    piece.setEndBefore(hole);
    pieces.push(piece);
    piece = range.cloneRange();
    piece.setStartAfter(hole);
  }
  pieces.push(piece);
  return pieces.filter((part) => !part.collapsed);
}

/** Blocks with an open comment carry `data-commented`, "strong" for the one in focus. */
function useBlockMarks(
  places: () => Map<string, Place>,
  focus: string | null,
  hovered: string | null,
) {
  useEffect(() => {
    const marked: HTMLElement[] = [];
    for (const [id, place] of places()) {
      if (place.kind !== "block") continue;
      const strong = id === focus || id === hovered;
      if (strong || place.element.dataset.commented === undefined) {
        place.element.dataset.commented = strong ? "strong" : "";
      }
      marked.push(place.element);
    }
    return () => {
      for (const element of marked) delete element.dataset.commented;
    };
  }, [places, focus, hovered]);
}

function useClickToOpen(
  root: RefObject<HTMLElement | null>,
  ranges: () => Map<string, Range>,
  setActive: (id: string | null) => void,
) {
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    function onClick(event: MouseEvent) {
      if (!window.getSelection()?.isCollapsed) return;
      const point = document.caretPositionFromPoint(event.clientX, event.clientY);
      if (!point) return;
      // Where passages overlap, the narrowest one is the most specific answer.
      const hits = [...ranges()]
        .filter(
          ([id, range]) =>
            id !== DRAFT &&
            id !== SELECTION &&
            range.isPointInRange(point.offsetNode, point.offset),
        )
        .toSorted(([, a], [, b]) => a.toString().length - b.toString().length);
      setActive(hits[0]?.[0] ?? null);
    }
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }, [root, ranges, setActive]);
}

/** `J` and `K` walk through the comments, `Esc` closes the open one, `⌘⌥M` comments, as in Google Docs. */
function useKeys(
  shown: Thread[],
  places: () => Map<string, Place>,
  active: string | null,
  setActive: (id: string | null) => void,
  startDraft: (target?: Target) => void,
) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyM") {
        event.preventDefault();
        startDraft();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, [contenteditable]")
      ) {
        return;
      }
      if (event.key === "Escape" && active) {
        setActive(null);
        return;
      }
      const step = { j: 1, k: -1 }[event.key];
      if (!step || shown.length === 0) return;
      const index = shown.findIndex((thread) => thread.id === active);
      // With none open, J starts at the first comment and K at the last.
      const from = index === -1 && step < 0 ? 0 : index;
      const next = shown[(from + step + shown.length) % shown.length]!;
      setActive(next.id);
      const place = places().get(next.id);
      if (place) scrollToPlace(place);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, places, active, setActive, startDraft]);
}

/** On a phone, a selection brings a bar to the bottom of the screen, clear of the system's menu. */
export function SelectionBar() {
  const { selection, draft, startDraft, wide } = useComments();
  if (wide || !selection || draft) return null;
  return (
    <div className="selection-bar">
      <button
        type="button"
        className="text-button"
        // Keeps the selection alive until the tap lands.
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => startDraft()}
      >
        <Manicule className="manicule" pointing="left" />
        Comment
      </button>
    </div>
  );
}

/** On a phone, the open thread or the new comment in a sheet over the lower half of the screen. */
export function CommentsSheet() {
  const comments = useComments();
  const { shown, active, setActive, draft, cancelDraft, wide, source, places } = comments;
  const index = shown.findIndex((thread) => thread.id === active);
  const thread = index === -1 ? null : shown[index];
  const focused = draft ? DRAFT : thread?.id;

  // The sheet covers the lower half of the screen, so the passage moves into the upper part.
  useEffect(() => {
    const place = !wide && focused ? places().get(focused) : undefined;
    if (!place) return;
    const box =
      place.kind === "text"
        ? place.range.getBoundingClientRect()
        : place.element.getBoundingClientRect();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({
      top: box.top - window.innerHeight * 0.2,
      behavior: still ? "auto" : "smooth",
    });
  }, [focused, wide, places]);

  if (wide) return null;
  const step = (by: number) =>
    setActive(shown[(index + by + shown.length) % shown.length]?.id ?? null);
  return (
    <Sheet
      open={Boolean(draft || thread)}
      onClose={() => {
        cancelDraft();
        setActive(null);
      }}
      label="Comment"
      className="comments-sheet"
    >
      {draft ? (
        <Composer
          passage={source.slice(draft.start, draft.end)}
          canSuggest={draft.kind === "text"}
          onSubmit={async (input) => {
            await comments.comment.mutateAsync({ ...draft, ...input });
            cancelDraft();
          }}
          onCancel={cancelDraft}
        />
      ) : null}
      {thread ? (
        <>
          {shown.length > 1 ? (
            <div className="sheet-nav">
              <button
                type="button"
                className="icon-button"
                aria-label="Previous comment"
                onClick={() => step(-1)}
              >
                <BackIcon />
              </button>
              <span>
                {index + 1} of {shown.length}
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="Next comment"
                onClick={() => step(1)}
              >
                <ForwardIcon />
              </button>
            </div>
          ) : null}
          <ThreadActions thread={thread} />
        </>
      ) : null}
    </Sheet>
  );
}

/** An open thread wired to the server. */
export function ThreadActions({ thread }: { thread: Thread }) {
  const { reply, setState, accept, setActive, moderate } = useComments();
  return (
    <OpenThread
      thread={thread}
      busy={setState.isPending || accept.isPending}
      onReply={(body) => reply.mutateAsync({ commentId: thread.id, body })}
      moderation={
        moderate
          ? {
              onResolve: () => {
                setState.mutate({ commentId: thread.id, state: "resolved" });
                setActive(null);
              },
              onReopen: () => setState.mutate({ commentId: thread.id, state: "open" }),
              onAccept: () => accept.mutate(thread.id),
            }
          : null
      }
    />
  );
}

/** Open threads whose passage was rewritten in a later version, so they left the margin. */
function useDetached(): Thread[] {
  const { threads, shown, writable } = useComments();
  return useMemo(() => {
    if (!writable) return [];
    const inMargin = new Set(shown.map((thread) => thread.id));
    return threads.filter((thread) => thread.status !== "resolved" && !inMargin.has(thread.id));
  }, [threads, shown, writable]);
}

/** On a wide screen, comments on changed text open from the top of the margin. */
export function OtherComments() {
  const detached = useDetached();
  const menuId = useId();
  if (detached.length === 0) return null;
  return (
    <div className="other-comments">
      <button type="button" className="byline-button" popoverTarget={menuId}>
        <CommentIcon />
        {detached.length} on changed text
        <OpenMenuIcon className="byline-caret" />
      </button>
      <div
        id={menuId}
        popover="auto"
        className="popover menu other-comments-menu"
        aria-label="Comments on text that changed"
      >
        <OtherThreadList threads={detached} />
      </div>
    </div>
  );
}

/** On a phone, comments on changed text follow the text. */
export function CommentsEnd() {
  const detached = useDetached();
  if (detached.length === 0) return null;
  return (
    <section className="comments-end" aria-label="Comments on text that changed">
      <details open>
        <summary>Comments on text that changed ({detached.length})</summary>
        <OtherThreadList threads={detached} />
      </details>
    </section>
  );
}

function OtherThreadList({ threads }: { threads: Thread[] }) {
  return (
    <ol className="other-threads">
      {threads.map((thread) => (
        <li key={thread.id}>
          <Passage thread={thread} />
          <ThreadActions thread={thread} />
        </li>
      ))}
    </ol>
  );
}
