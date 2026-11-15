import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { Range as SourceRange } from "#/anchor";
import { BackIcon, ForwardIcon } from "#/components/ui/icons";
import { Sheet } from "#/components/ui/sheet";
import { Manicule } from "#/components/ui/wordmark";

import { domRange, selectedSource } from "./dom";
import { Composer, OpenThread } from "./thread";
import { type Thread, useThreads } from "./use-threads";

/** Keys for the two passages that are not threads yet, in `ranges()`. */
export const DRAFT = "draft";
export const SELECTION = "selection";

type Comments = ReturnType<typeof useThreads> & {
  source: string;
  root: RefObject<HTMLElement | null>;
  /** Open threads on the current version, in the order of their passages. */
  open: Thread[];
  /** Where each open thread, the new comment and the selection sit in the page right now. */
  ranges: () => Map<string, Range>;
  active: string | null;
  setActive: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  /** The passage the reader selected, before they chose to comment on it. */
  selection: SourceRange | null;
  /** The passage of the comment being written. */
  draft: SourceRange | null;
  startDraft: () => void;
  cancelDraft: () => void;
  wide: boolean;
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
  children,
}: {
  documentId: string;
  version: number;
  source: string;
  root: RefObject<HTMLElement | null>;
  active: string | null;
  setActive: (id: string | null) => void;
  children: ReactNode;
}) {
  const data = useThreads(documentId, version);
  const [draft, setDraft] = useState<SourceRange | null>(null);
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

  const ranges = useCallback(() => {
    const found = new Map<string, Range>();
    const element = root.current;
    if (!element) return found;
    const place = (id: string, target: SourceRange | null) => {
      const range = target && domRange(element, source, target);
      if (range) found.set(id, range);
    };
    for (const thread of open) place(thread.id, thread.anchor);
    place(DRAFT, draft);
    place(SELECTION, draft ? null : selection);
    return found;
  }, [root, source, open, draft, selection]);

  const startDraft = useCallback(() => {
    if (!selection) return;
    setActive(null);
    setDraft(selection);
    window.getSelection()?.removeAllRanges();
  }, [selection, setActive]);
  const cancelDraft = useCallback(() => setDraft(null), []);

  useHighlights(ranges, draft ? DRAFT : active, hovered);
  useClickToOpen(root, ranges, setActive);
  useKeys(open, ranges, active, setActive, startDraft);

  const value = useMemo(
    () => ({
      ...data,
      source,
      root,
      open,
      ranges,
      active,
      setActive,
      setHovered,
      selection,
      draft,
      startDraft,
      cancelDraft,
      wide,
    }),
    [
      data,
      source,
      root,
      open,
      ranges,
      active,
      setActive,
      selection,
      draft,
      startDraft,
      cancelDraft,
      wide,
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
    CSS.highlights.set(
      "comment",
      new Highlight(...marked.filter(([id]) => !strong.has(id)).map(([, range]) => range)),
    );
    CSS.highlights.set(
      "comment-active",
      new Highlight(...marked.filter(([id]) => strong.has(id)).map(([, range]) => range)),
    );
    // A highlight paints only over text, so inline code drops its own box inside one.
    const codes = marked.flatMap(([, range]) => inlineCodeIn(range));
    for (const code of codes) code.dataset.marked = "";
    return () => {
      CSS.highlights.delete("comment");
      CSS.highlights.delete("comment-active");
      for (const code of codes) delete code.dataset.marked;
    };
  }, [ranges, active, hovered]);
}

function inlineCodeIn(range: Range): HTMLElement[] {
  const scope = range.commonAncestorContainer;
  const root = scope instanceof Element ? scope : scope.parentElement;
  if (!root) return [];
  const inside = root.closest(":not(pre) > code");
  if (inside instanceof HTMLElement) return [inside];
  return [...root.querySelectorAll<HTMLElement>(":not(pre) > code")].filter((code) =>
    range.intersectsNode(code),
  );
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
  ranges: () => Map<string, Range>,
  active: string | null,
  setActive: (id: string | null) => void,
  startDraft: () => void,
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
      ranges().get(next.id)?.startContainer.parentElement?.scrollIntoView({ block: "center" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, ranges, active, setActive, startDraft]);
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
        onClick={startDraft}
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
  const { open, active, setActive, draft, cancelDraft, wide, source, ranges } = comments;
  const index = open.findIndex((thread) => thread.id === active);
  const thread = index === -1 ? null : open[index];
  const shown = draft ? DRAFT : thread?.id;

  // The sheet covers the lower half of the screen, so the passage moves into the upper part.
  useEffect(() => {
    const range = !wide && shown ? ranges().get(shown) : undefined;
    if (!range) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = range.getBoundingClientRect().top - window.innerHeight * 0.2;
    window.scrollBy({ top, behavior: still ? "auto" : "smooth" });
  }, [shown, wide, ranges]);

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
  const { reply, setState, accept, setActive } = useComments();
  return (
    <OpenThread
      thread={thread}
      busy={setState.isPending || accept.isPending}
      onReply={(body) => reply.mutateAsync({ commentId: thread.id, body })}
      onResolve={() => {
        setState.mutate({ commentId: thread.id, state: "resolved" });
        setActive(null);
      }}
      onReopen={() => setState.mutate({ commentId: thread.id, state: "open" })}
      onAccept={() => accept.mutate(thread.id)}
    />
  );
}

/** Threads that left the margin: their passage was rewritten, or they were resolved. */
export function CommentsEnd() {
  const { threads, open } = useComments();
  const shown = new Set(open.map((thread) => thread.id));
  const detached = threads.filter(
    (thread) => thread.status !== "resolved" && !shown.has(thread.id),
  );
  const resolved = threads.filter((thread) => thread.status === "resolved");
  if (detached.length === 0 && resolved.length === 0) return null;
  return (
    <section className="comments-end" aria-label="Other comments">
      {detached.length > 0 ? (
        <details open>
          <summary>Comments on text that changed ({detached.length})</summary>
          {detached.map((thread) => (
            <EndThread key={thread.id} thread={thread} />
          ))}
        </details>
      ) : null}
      {resolved.length > 0 ? (
        <details>
          <summary>Resolved ({resolved.length})</summary>
          {resolved.map((thread) => (
            <EndThread key={thread.id} thread={thread} />
          ))}
        </details>
      ) : null}
    </section>
  );
}

function EndThread({ thread }: { thread: Thread }) {
  return (
    <div className="comments-end-thread">
      <blockquote>{thread.anchor.exact}</blockquote>
      <ThreadActions thread={thread} />
    </div>
  );
}
