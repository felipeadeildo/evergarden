import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";

import { RelativeTime } from "#/components/ui/relative-time";
import { textField } from "#/lib/form";

import type { Thread } from "./use-threads";

function Byline({ name, date }: { name: string; date: Date }) {
  return (
    <span className="note-byline">
      {name}, <RelativeTime date={date} />
    </span>
  );
}

/** A thread folded to its first line, as it sits in the margin until it is opened. */
export function FoldedThread({ thread, onOpen }: { thread: Thread; onOpen: () => void }) {
  const replies = thread.replies.length;
  return (
    <button type="button" className="note note-folded" onClick={onOpen}>
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
  const replyForm = useId();
  return (
    <article className="note note-open" aria-label={`Comment by ${thread.author.name}`}>
      <p className="note-body">{thread.body}</p>
      <Byline name={thread.author.name} date={thread.createdAt} />
      {thread.suggestion !== null ? (
        <div className="note-suggestion">
          <span className="note-suggestion-label">Suggested</span>
          <del>{thread.anchor.exact}</del>
          <ins>{thread.suggestion}</ins>
        </div>
      ) : null}
      {thread.replies.map((reply) => (
        <div key={reply.id} className="note-reply">
          <p className="note-body">{reply.body}</p>
          <Byline name={reply.author.name} date={reply.createdAt} />
        </div>
      ))}
      {resolved ? null : <ReplyForm id={replyForm} onReply={onReply} />}
      <div className="note-actions">
        {resolved ? (
          <button type="button" className="quiet-button" disabled={busy} onClick={onReopen}>
            Reopen
          </button>
        ) : (
          <button type="button" className="quiet-button" disabled={busy} onClick={onResolve}>
            Resolve
          </button>
        )}
        {thread.suggestion !== null && thread.status === "open" ? (
          <button type="button" className="quiet-button" disabled={busy} onClick={onAccept}>
            Accept
          </button>
        ) : null}
        {resolved ? null : (
          <button type="submit" form={replyForm} className="button button-small note-primary">
            Reply
          </button>
        )}
      </div>
    </article>
  );
}

function ReplyForm({ id, onReply }: { id: string; onReply: (body: string) => Promise<unknown> }) {
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = textField(new FormData(form), "body").trim();
    if (!body) return;
    await onReply(body);
    form.reset();
  }

  return (
    <form id={id} className="note-form" onSubmit={(event) => void submit(event)}>
      <textarea
        name="body"
        rows={1}
        placeholder="Reply"
        aria-label="Reply"
        required
        onKeyDown={submitOnModEnter}
      />
    </form>
  );
}

/** A new comment on a passage, with an optional rewrite of it. */
export function Composer({
  passage,
  onSubmit,
  onCancel,
}: {
  passage: string;
  onSubmit: (input: { body: string; suggestion?: string }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  useEffect(() => body.current?.focus(), []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await onSubmit({
        body: textField(form, "body"),
        suggestion: suggesting ? textField(form, "suggestion") : undefined,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The comment was not saved.");
      setPending(false);
    }
  }

  return (
    <form className="note note-open note-composer" onSubmit={(event) => void submit(event)}>
      <textarea
        ref={body}
        name="body"
        rows={2}
        placeholder="Comment"
        aria-label="Comment"
        required
        onKeyDown={(event) => composerKeys(event, onCancel)}
      />
      {suggesting ? (
        <label className="note-field">
          <span>Replace the passage with</span>
          <textarea
            name="suggestion"
            rows={3}
            defaultValue={passage}
            onKeyDown={(event) => composerKeys(event, onCancel)}
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="quiet-button note-toggle"
        aria-pressed={suggesting}
        onClick={() => setSuggesting(!suggesting)}
      >
        {suggesting ? "Keep the passage" : "Suggest a rewrite"}
      </button>
      <div className="note-actions">
        <button type="button" className="quiet-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button-small note-primary" disabled={pending}>
          Comment
        </button>
      </div>
    </form>
  );
}

function composerKeys(event: React.KeyboardEvent<HTMLTextAreaElement>, cancel: () => void) {
  if (event.key === "Escape") cancel();
  else submitOnModEnter(event);
}

function submitOnModEnter(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}
