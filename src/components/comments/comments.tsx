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
import { BackIcon, CommentIcon, ForwardIcon } from "#/components/ui/icons";
import { Sheet } from "#/components/ui/sheet";

import { domRange, selectedSource } from "./dom";
import { Composer, OpenThread } from "./thread";
import { type Thread, useThreads } from "./use-threads";

type Comments = ReturnType<typeof useThreads> & {
  source: string;
  root: RefObject<HTMLElement | null>;
  /** Open threads on the current version, in the order of their passages. */
  open: Thread[];
  /** Where each open thread, and the new comment, sits in the page right now. */
  ranges: () => Map<string, Range>;
  active: string | null;
  setActive: (id: string | null) => void;
  draft: SourceRange | null;
  setDraft: (range: SourceRange | null) => void;
  wide: boolean;
};

const CommentsContext = createContext<Comments | null>(null);

export function useComments(): Comments {
  const comments = useContext(CommentsContext);
  if (!comments) throw new Error("useComments needs a CommentsProvider");
  return comments;
}

const WIDE = "(min-width: 1200px)";
const DRAFT = "draft";

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
  const wide = useMediaQuery(WIDE);

  const open = useMemo(
    () =>
      data.threads
        .filter((thread) => thread.status === "open" && thread.version === version)
        .toSorted((a, b) => a.anchor.start - b.anchor.start),
    [data.threads, version],
  );

  const ranges = useCallback(() => {
    const found = new Map<string, Range>();
    const element = root.current;
    if (!element) return found;
    for (const thread of open) {
      const range = domRange(element, source, thread.anchor);
      if (range) found.set(thread.id, range);
    }
    const draftRange = draft && domRange(element, source, draft);
    if (draftRange) found.set(DRAFT, draftRange);
    return found;
  }, [root, source, open, draft]);

  useHighlights(ranges, draft ? DRAFT : active);
  useClickToOpen(root, ranges, setActive);
  useKeys(open, ranges, active, setActive);

  const value = useMemo(
    () => ({ ...data, source, root, open, ranges, active, setActive, draft, setDraft, wide }),
    [data, source, root, open, ranges, active, setActive, draft, wide],
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

/** Marks passages with the CSS Custom Highlight API, which paints text without touching the DOM. */
function useHighlights(ranges: () => Map<string, Range>, active: string | null) {
  useEffect(() => {
    if (typeof CSS === "undefined" || !("highlights" in CSS)) return undefined;
    const found = ranges();
    const rest = [...found].filter(([id]) => id !== active).map(([, range]) => range);
    const current = active ? found.get(active) : undefined;
    CSS.highlights.set("comment", new Highlight(...rest));
    CSS.highlights.set("comment-active", new Highlight(...(current ? [current] : [])));
    return () => {
      CSS.highlights.delete("comment");
      CSS.highlights.delete("comment-active");
    };
  }, [ranges, active]);
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
      const point = caretAt(event.clientX, event.clientY);
      if (!point) return;
      for (const [id, range] of ranges()) {
        if (id !== DRAFT && range.isPointInRange(point.node, point.offset)) {
          setActive(id);
          return;
        }
      }
      setActive(null);
    }
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }, [root, ranges, setActive]);
}

/** `J` and `K` walk through the comments, `Esc` closes the open one, as in Google Docs. */
function useKeys(
  open: Thread[],
  ranges: () => Map<string, Range>,
  active: string | null,
  setActive: (id: string | null) => void,
) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
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
  }, [open, ranges, active, setActive]);
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const position = document.caretPositionFromPoint(x, y);
  return position ? { node: position.offsetNode, offset: position.offset } : null;
}

/** The Comment button for a selection: beside it on desktop, at the bottom of the screen on a phone. */
export function SelectionAction() {
  const { root, source, draft, setDraft, setActive, wide } = useComments();
  const [selection, setSelection] = useState<{ range: SourceRange; rect: DOMRect } | null>(null);

  useEffect(() => {
    let frame = 0;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = root.current;
        const range = element ? selectedSource(element, source) : null;
        const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
        setSelection(range && rect ? { range, rect } : null);
      });
    }
    document.addEventListener("selectionchange", update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", update);
    };
  }, [root, source]);

  const start = useCallback(() => {
    if (!selection) return;
    setActive(null);
    setDraft(selection.range);
    window.getSelection()?.removeAllRanges();
  }, [selection, setActive, setDraft]);

  // ⌘⌥M, as in Google Docs.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyM") {
        event.preventDefault();
        start();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start]);

  if (!selection || draft) return null;
  const style = wide
    ? { top: selection.rect.top - 44, left: selection.rect.left + selection.rect.width / 2 }
    : undefined;
  return (
    <div className={wide ? "selection-action" : "selection-bar"} style={style}>
      <button
        type="button"
        className="button button-small"
        // Keeps the selection alive until the click lands.
        onPointerDown={(event) => event.preventDefault()}
        onClick={start}
      >
        <CommentIcon />
        Comment
      </button>
    </div>
  );
}

/** On a phone, the open thread or the new comment in a sheet over the lower half of the screen. */
export function CommentsSheet() {
  const comments = useComments();
  const { open, active, setActive, draft, setDraft, wide, source, ranges } = comments;
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
        setDraft(null);
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
            setDraft(null);
          }}
          onCancel={() => setDraft(null)}
        />
      ) : null}
      {thread ? (
        <>
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
            <blockquote key={thread.id} className="comments-end-quote">
              <p>{thread.anchor.exact}</p>
              <ThreadActions thread={thread} />
            </blockquote>
          ))}
        </details>
      ) : null}
      {resolved.length > 0 ? (
        <details>
          <summary>Resolved ({resolved.length})</summary>
          {resolved.map((thread) => (
            <blockquote key={thread.id} className="comments-end-quote">
              <p>{thread.anchor.exact}</p>
              <ThreadActions thread={thread} />
            </blockquote>
          ))}
        </details>
      ) : null}
    </section>
  );
}
