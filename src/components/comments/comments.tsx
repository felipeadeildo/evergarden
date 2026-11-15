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
  /** Open threads on the current version, in the order of their passages. */
  open: Thread[];
  /** The text passages of open threads, the new comment and the selection, as DOM ranges. */
  ranges: () => Map<string, Range>;
  /** Where each open thread and the new comment sit in the page right now, whatever their kind. */
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
};

const CommentsContext = createContext<Comments | null>(null);

export function useComments(): Comments {
  const comments = useContext(CommentsContext);
  if (!comments) throw new Error("useComments needs a CommentsProvider");
  return comments;
}

export function CommentsProvider({
  documentId,
  version,
  source,
  root,
  active,
  setActive,
  moderate,
  children,
}: {
  documentId: string;
  version: number;
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

  const open = useMemo(
    () =>
      data.threads
        .filter((thread) => thread.status === "open" && thread.version === version)
        .toSorted((a, b) => a.anchor.start - b.anchor.start || b.anchor.end - a.anchor.end),
    [data.threads, version],
  );

  const targets = useMemo(() => {
    const all = new Map<string, Target>(open.map((thread) => [thread.id, thread.anchor]));
    if (draft) all.set(DRAFT, draft);
    return all;
  }, [open, draft]);

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
      if (!chosen) return;
      setActive(null);
      setDraft(chosen);
      window.getSelection()?.removeAllRanges();
    },
    [selection, setActive],
  );
  const cancelDraft = useCallback(() => setDraft(null), []);

  const focus = draft ? DRAFT : active;
  useHighlights(ranges, focus, hovered);
  useBlockMarks(places, focus, hovered);
  useClickToOpen(root, ranges, setActive);
  useKeys(open, places, active, setActive, startDraft);

  const value = useMemo(
    () => ({
      ...data,
      source,
      root,
      open,
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
    }),
    [
      data,
      source,
      root,
      open,
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
  open: Thread[],
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
      if (!step || open.length === 0) return;
      const index = open.findIndex((thread) => thread.id === active);
      // With none open, J starts at the first comment and K at the last.
      const from = index === -1 && step < 0 ? 0 : index;
      const next = open[(from + step + open.length) % open.length]!;
      setActive(next.id);
      const place = places().get(next.id);
      if (place) scrollToPlace(place);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, places, active, setActive, startDraft]);
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
  const { open, active, setActive, draft, cancelDraft, wide, source, places } = comments;
  const index = open.findIndex((thread) => thread.id === active);
  const thread = index === -1 ? null : open[index];
  const shown = draft ? DRAFT : thread?.id;

  // The sheet covers the lower half of the screen, so the passage moves into the upper part.
  useEffect(() => {
    const place = !wide && shown ? places().get(shown) : undefined;
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
  }, [shown, wide, places]);

  if (wide) return null;
  const step = (by: number) =>
    setActive(open[(index + by + open.length) % open.length]?.id ?? null);
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
          {open.length > 1 ? (
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
                {index + 1} of {open.length}
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

/** Threads that left the margin: their passage was rewritten, or they were resolved. */
function useOtherThreads(): { detached: Thread[]; resolved: Thread[] } {
  const { threads, open } = useComments();
  return useMemo(() => {
    const shown = new Set(open.map((thread) => thread.id));
    return {
      detached: threads.filter((thread) => thread.status !== "resolved" && !shown.has(thread.id)),
      resolved: threads.filter((thread) => thread.status === "resolved"),
    };
  }, [threads, open]);
}

/** On a wide screen, the other threads open from the top of the margin. */
export function OtherComments() {
  const { detached, resolved } = useOtherThreads();
  const menuId = useId();
  if (detached.length === 0 && resolved.length === 0) return null;
  const label = [
    detached.length > 0 ? `${detached.length} on changed text` : null,
    resolved.length > 0 ? `${resolved.length} resolved` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="other-comments">
      <button type="button" className="byline-button" popoverTarget={menuId}>
        <CommentIcon />
        {label}
        <OpenMenuIcon className="byline-caret" />
      </button>
      <div id={menuId} popover="auto" className="popover menu other-comments-menu">
        {detached.length > 0 ? (
          <section aria-label="Comments on text that changed">
            <h2 className="menu-title">On text that changed</h2>
            <OtherThreadList threads={detached} />
          </section>
        ) : null}
        {resolved.length > 0 ? (
          <section aria-label="Resolved comments">
            <h2 className="menu-title">Resolved</h2>
            <OtherThreadList threads={resolved} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** On a phone, the other threads follow the text. */
export function CommentsEnd() {
  const { detached, resolved } = useOtherThreads();
  if (detached.length === 0 && resolved.length === 0) return null;
  return (
    <section className="comments-end" aria-label="Other comments">
      {detached.length > 0 ? (
        <details open>
          <summary>Comments on text that changed ({detached.length})</summary>
          <OtherThreadList threads={detached} />
        </details>
      ) : null}
      {resolved.length > 0 ? (
        <details>
          <summary>Resolved ({resolved.length})</summary>
          <OtherThreadList threads={resolved} />
        </details>
      ) : null}
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
