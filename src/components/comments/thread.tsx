import { type SubmitEvent, useEffect, useRef, useState } from "react";

import { CheckIcon, EditIcon, ReopenIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";

import type { Thread } from "./use-threads";

function Byline({ name, date }: { name: string; date: Date }) {
  return (
    <p className="note-byline">
      {name}, <RelativeTime date={date} />
    </p>
  );
}

/** The passage a thread is on, as the reader saw it, cut to two lines. */
export function Passage({ thread }: { thread: Thread }) {
  const starts = thread.passage.map((_, i) =>
    thread.passage.slice(0, i).reduce((sum, piece) => sum + piece.text.length, 0),
  );
  return (
    <blockquote className="note-passage">
      {thread.passage.map((piece, i) =>
        piece.code ? <code key={starts[i]}>{piece.text}</code> : piece.text,
      )}
    </blockquote>
  );
}

/** A thread folded to its first line, as it sits in the margin until it is opened. */
export function FoldedThread({
  thread,
  onOpen,
  onHover,
}: {
  thread: Thread;
  onOpen: () => void;
  onHover: (hovered: boolean) => void;
}) {
  const replies = thread.replies.length;
  return (
    <button
      type="button"
      className="note note-folded"
      onClick={() => {
        // The folded note unmounts as it opens, before its pointerleave would fire.
        onHover(false);
        onOpen();
      }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <span className="note-line">{thread.body}</span>
      <span className="note-byline">
        {thread.author.name}
        {replies ? `, ${replies} ${replies === 1 ? "reply" : "replies"}` : null}
      </span>
    </button>
  );
}

export function OpenThread({
  thread,
  onReply,
  onResolve,
  onReopen,
  onAccept,
  busy,
}: {
  thread: Thread;
  onReply: (body: string) => Promise<unknown>;
  onResolve: () => void;
  onReopen: () => void;
  onAccept: () => void;
  busy: boolean;
}) {
  const resolved = thread.status === "resolved";
  return (
    <article className="note note-open" aria-label={`Comment by ${thread.author.name}`}>
      <div className="note-entry note-head">
        <p className="note-body">{thread.body}</p>
        {resolved ? (
          <button
            type="button"
            className="icon-button note-state"
            aria-label="Reopen"
            title="Reopen"
            disabled={busy}
            onClick={onReopen}
          >
            <ReopenIcon />
          </button>
        ) : (
          <button
            type="button"
            className="icon-button note-state"
            aria-label="Resolve"
            title="Resolve"
            disabled={busy}
            onClick={onResolve}
          >
            <CheckIcon />
          </button>
        )}
        <Byline name={thread.author.name} date={thread.createdAt} />
      </div>
      {thread.suggestion !== null ? (
        <div className="note-suggestion">
          <del>{thread.anchor.exact}</del>
          <ins>{thread.suggestion}</ins>
          {thread.status === "open" ? (
            <button type="button" className="text-button" disabled={busy} onClick={onAccept}>
              Accept
            </button>
          ) : null}
        </div>
      ) : null}
      {thread.replies.map((reply) => (
        <div key={reply.id} className="note-entry">
          <p className="note-body">{reply.body}</p>
          <Byline name={reply.author.name} date={reply.createdAt} />
        </div>
      ))}
      {resolved ? null : <ReplyBox onReply={onReply} />}
    </article>
  );
}

/** One quiet line that grows into a reply, with its buttons only once there is something to send. */
function ReplyBox({ onReply }: { onReply: (body: string) => Promise<unknown> }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setPending(true);
    await onReply(body);
    setPending(false);
    setText("");
  }

  return (
    <form className="note-reply" onSubmit={(event) => void submit(event)}>
      <textarea
        className="note-field"
        name="body"
        rows={1}
        placeholder="Reply…"
        aria-label="Reply"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => keys(event, () => setText(""))}
      />
      {text.trim() ? (
        <div className="note-actions">
          <button type="button" className="text-button quiet" onClick={() => setText("")}>
            Cancel
          </button>
          <button type="submit" className="text-button" disabled={pending}>
            Reply
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** A new comment on a passage, with an optional edit of it. */
export function Composer({
  passage,
  canSuggest = true,
  onSubmit,
  onCancel,
}: {
  passage: string;
  /** Only text has a rewrite to suggest; blocks and figures take comments alone. */
  canSuggest?: boolean;
  onSubmit: (input: { body: string; suggestion?: string }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [text, setText] = useState("");
  const [rewrite, setRewrite] = useState(passage);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  useEffect(() => body.current?.focus(), []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setPending(true);
    try {
      await onSubmit({ body: text, suggestion: suggesting ? rewrite : undefined });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The comment was not saved.");
      setPending(false);
    }
  }

  return (
    <form className="note note-open note-composer" onSubmit={(event) => void submit(event)}>
      <textarea
        ref={body}
        className="note-field"
        name="body"
        rows={2}
        placeholder="Add a comment…"
        aria-label="Comment"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => keys(event, onCancel)}
      />
      {suggesting ? (
        <label className="note-suggestion note-suggestion-edit">
          <span className="sr-only">Replace the passage with</span>
          {rewrite === passage ? null : <del>{passage}</del>}
          <textarea
            className="note-field"
            name="suggestion"
            rows={1}
            value={rewrite}
            onChange={(event) => setRewrite(event.target.value)}
            onKeyDown={(event) => keys(event, onCancel)}
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <div className="note-actions">
        {canSuggest ? (
          <button
            type="button"
            className="text-button quiet note-toggle"
            aria-pressed={suggesting}
            onClick={() => setSuggesting(!suggesting)}
          >
            <EditIcon />
            Suggest
          </button>
        ) : null}
        <button type="button" className="text-button quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="text-button" disabled={pending || !text.trim()}>
          Comment
        </button>
      </div>
    </form>
  );
}

/** `⌘↵` sends, `Esc` cancels. */
function keys(event: React.KeyboardEvent<HTMLTextAreaElement>, cancel: () => void) {
  if (event.key === "Escape") {
    event.stopPropagation();
    cancel();
  } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}
