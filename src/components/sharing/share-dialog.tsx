import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Choice } from "#/components/ui/choice";
import { CopyButton } from "#/components/ui/copy-button";
import { ShareIcon } from "#/components/ui/icons";
import { Sheet } from "#/components/ui/sheet";
import { getSharing, updateSharing } from "#/functions/sharing.functions";

export type ShareSubject = { kind: "document" | "folder"; id: string };

type Who = "private" | "read" | "comment";
type Expiry = "never" | "7" | "30";

/** The Share button in the top bar, and the dialog it opens. */
export function ShareButton({ subject }: { subject: ShareSubject }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="quiet-button" onClick={() => setOpen(true)}>
        <ShareIcon />
        <span className="label">Share</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Share" className="share-sheet">
        <ShareSettings subject={subject} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/**
 * Who besides you can open this page, at its usual address. Each choice applies at once, as in
 * a document editor; a folder's setting covers everything inside it.
 */
function ShareSettings({ subject, onDone }: { subject: ShareSubject; onDone: () => void }) {
  const queryClient = useQueryClient();
  const queryKey = ["sharing", subject.kind, subject.id];
  const current = useQuery({ queryKey, queryFn: () => getSharing({ data: subject }) });
  const save = useMutation({
    mutationFn: (choice: { who: Who; expires: Expiry }) =>
      updateSharing({
        data: {
          ...subject,
          permission: choice.who === "private" ? null : choice.who,
          expiresInDays: choice.expires === "never" ? null : Number(choice.expires),
        },
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["shared-list"] }),
      ]),
  });
  const [expires, setExpires] = useState<Expiry>("never");

  if (!current.isSuccess) return <h2 className="share-title">Share</h2>;
  const shared = current.data;
  const own = shared && shared.through.kind === subject.kind && shared.through.id === subject.id;
  // The choice shows at once; the server confirms it a moment later.
  const saved: Who = own ? shared.permission : "private";
  const who = save.isPending ? save.variables.who : saved;
  const inherited = shared && !own ? shared : null;
  const url = new URL(`/${subject.kind === "folder" ? "f" : "d"}/${subject.id}`, location.href)
    .href;

  return (
    <div className="share-form">
      <h2 className="share-title">Share</h2>
      {inherited ? (
        <p className="share-note">
          The folder <strong>{inherited.through.name}</strong> is shared: anyone with the link can{" "}
          {inherited.permission === "comment" ? "read and comment on" : "read"} this {subject.kind}.
        </p>
      ) : null}
      <Choice
        label="Who can open it"
        value={who}
        onChange={(next) => save.mutate({ who: next, expires })}
        options={[
          { value: "private", label: inherited ? `Same as ${inherited.through.name}` : "Only you" },
          { value: "read", label: "Anyone with the link can read" },
          { value: "comment", label: "…can read and comment" },
        ]}
      />
      {who === "private" ? null : (
        <Choice
          label="Stops working"
          value={expires}
          onChange={(next) => {
            setExpires(next);
            save.mutate({ who, expires: next });
          }}
          options={[
            { value: "never", label: "Never" },
            { value: "7", label: "In 7 days" },
            { value: "30", label: "In 30 days" },
          ]}
        />
      )}
      <div className="line">
        <code>{url}</code>
        <CopyButton text={url} label="Copy link" iconOnly />
      </div>
      <p className="share-note">{whatPeopleSee(shared?.permission ?? null)}</p>
      {save.isError ? (
        <p role="alert" className="form-error">
          {save.error.message}
        </p>
      ) : null}
      <div className="share-actions">
        <button type="button" className="button" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

function whatPeopleSee(permission: "read" | "comment" | null): string {
  if (permission === "comment") {
    return "People read without signing in, and sign in with a code sent to their email to comment.";
  }
  if (permission === "read") {
    return "People read without signing in. They see this and nothing else in your library.";
  }
  return "Only you can open this link.";
}
