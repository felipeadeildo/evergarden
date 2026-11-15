import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useState } from "react";

import { Choice } from "#/components/ui/choice";
import { CopyButton } from "#/components/ui/copy-button";
import { CloseIcon, PeopleIcon, PrivateIcon, ShareIcon } from "#/components/ui/icons";
import { Sheet } from "#/components/ui/sheet";
import { updateSharing } from "#/functions/sharing.functions";
import { isPersonOrDomain } from "#/lib/people";
import type { ShareSettings, SharingState } from "#/server/sharing";

import { effective, kindOf, sentence, shortLabel } from "./summary";

export type ShareSubject = { kind: "document" | "folder"; id: string };

type Who = "private" | "people" | "link";
type Expiry = "keep" | "never" | "7" | "30";
type Draft = {
  who: Who;
  people: string[];
  permission: "read" | "comment";
  versions: "current" | "all";
  expires: Expiry;
};

const ICONS = { private: PrivateIcon, link: ShareIcon, people: PeopleIcon };

/**
 * The Share button in the top bar. It names the policy in force, "Only you" or "Link, read", and
 * opens the dialog that changes it.
 */
export function ShareButton({
  subject,
  sharing,
}: {
  subject: ShareSubject;
  sharing: SharingState | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(sharing);
  const shown = effective(state);
  const Icon = ICONS[kindOf(shown)];
  return (
    <>
      <button
        type="button"
        className="quiet-button share-button"
        data-shared={kindOf(shown)}
        title={sentence(shown)}
        onClick={() => setOpen(true)}
      >
        <Icon />
        <span className="label">{shortLabel(shown)}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Share" className="share-sheet">
        <ShareSettingsForm
          subject={subject}
          state={state}
          onSaved={setState}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}

function draftOf(own: ShareSettings | null): Draft {
  if (!own) {
    return {
      who: "private",
      people: [],
      permission: "read",
      versions: "current",
      expires: "never",
    };
  }
  return {
    who: own.audience,
    people: own.people,
    permission: own.permission,
    versions: own.versions,
    expires: own.expiresAt ? "keep" : "never",
  };
}

function daysLeft(expiresAt: Date): number {
  return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

/**
 * Who besides you can open this page, at its usual address. Every choice applies at once; the
 * text below always describes the choices shown, not what the server last said.
 */
function ShareSettingsForm({
  subject,
  state,
  onSaved,
  onDone,
}: {
  subject: ShareSubject;
  state: SharingState | null;
  onSaved: (state: SharingState) => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftOf(state?.own ?? null));
  const inherited = state?.inherited[0] ?? null;
  const save = useMutation({
    // Choices apply as they are clicked; saving them one after another keeps the last one.
    scope: { id: `sharing:${subject.id}` },
    mutationFn: (next: Draft) =>
      updateSharing({
        data: {
          ...subject,
          settings:
            next.who === "private"
              ? null
              : {
                  audience: next.who,
                  people: next.people,
                  permission: next.permission,
                  versions: next.versions,
                  expiresInDays: expiryDays(next.expires, state?.own?.expiresAt ?? null),
                },
        },
      }),
    onSuccess: (saved) => {
      onSaved(saved);
      // The library and Settings show what is shared; they catch up in the background.
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["shared-list"] });
      void queryClient.invalidateQueries({ queryKey: [`${subject.kind}-page`, subject.id] });
    },
  });

  function change(next: Partial<Draft>) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    // A list of people saves once it has someone on it.
    if (merged.who === "people" && merged.people.length === 0) return;
    save.mutate(merged);
  }

  const url = new URL(`/${subject.kind === "folder" ? "f" : "d"}/${subject.id}`, location.href)
    .href;
  const shown: ShareSettings | null =
    draft.who === "private"
      ? null
      : {
          audience: draft.who,
          people: draft.people,
          permission: draft.permission,
          versions: draft.versions,
          expiresAt: expiryDate(draft.expires, state?.own?.expiresAt ?? null),
        };

  return (
    <div className="share-form">
      <h2 className="share-title">Share</h2>
      {inherited ? (
        <p className="share-note">
          Through the folder <strong>{inherited.through.name}</strong>: {sentence(inherited)}
        </p>
      ) : null}
      <Choice
        label="Who can open it"
        value={draft.who}
        onChange={(who) => change({ who })}
        options={[
          { value: "private", label: inherited ? `Same as ${inherited.through.name}` : "Only you" },
          { value: "people", label: "People I list" },
          { value: "link", label: "Anyone with link" },
        ]}
      />
      {draft.who === "people" ? (
        <PeopleField people={draft.people} onChange={(people) => change({ people })} />
      ) : null}
      {draft.who === "private" ? null : (
        <>
          <Choice
            label="They can"
            value={draft.permission}
            onChange={(permission) => change({ permission })}
            options={[
              { value: "read", label: "Read" },
              { value: "comment", label: "Read and comment" },
            ]}
          />
          {subject.kind === "document" ? (
            <Choice
              label="Versions"
              value={draft.versions}
              onChange={(versions) => change({ versions })}
              options={[
                { value: "current", label: "Only the current one" },
                { value: "all", label: "All versions" },
              ]}
            />
          ) : null}
          <Choice
            label="Stops working"
            value={draft.expires}
            onChange={(expires) => change({ expires })}
            options={[
              ...(state?.own?.expiresAt
                ? [
                    {
                      value: "keep" as const,
                      label: `On ${day.format(new Date(state.own.expiresAt))}`,
                    },
                  ]
                : []),
              { value: "never", label: "Never" },
              { value: "7", label: "In 7 days" },
              { value: "30", label: "In 30 days" },
            ]}
          />
        </>
      )}
      <div className="line">
        <code>{url}</code>
        <CopyButton text={url} label="Copy link" iconOnly />
      </div>
      <p className="share-note" aria-live="polite">
        {draft.who === "people" && draft.people.length === 0
          ? "Add an email or an @domain to share."
          : sentence(shown)}
        {draft.who === "people" && draft.people.length > 0
          ? " They sign in with a code sent to their email; no email is sent until they do."
          : null}
      </p>
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

const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

function expiryDays(expires: Expiry, current: Date | null): number | null {
  if (expires === "keep") return current ? daysLeft(current) : null;
  return expires === "never" ? null : Number(expires);
}

function expiryDate(expires: Expiry, current: Date | null): Date | null {
  if (expires === "keep") return current;
  return expires === "never" ? null : new Date(Date.now() + Number(expires) * 86_400_000);
}

/** Emails and @domains as removable chips, added with Enter, a comma or a space. */
function PeopleField({
  people,
  onChange,
}: {
  people: string[];
  onChange: (people: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [wrong, setWrong] = useState<string | null>(null);

  function add() {
    const entries = text
      .split(/[\s,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    if (entries.length === 0) return;
    const bad = entries.find((entry) => !isPersonOrDomain(entry));
    if (bad) {
      setWrong(`"${bad}" is neither an email nor an @domain.`);
      return;
    }
    setWrong(null);
    setText("");
    onChange([...new Set([...people, ...entries])]);
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && !text && people.length > 0) {
      onChange(people.slice(0, -1));
    }
  }

  return (
    <div className="people-field">
      <ul className="people-chips">
        {people.map((entry) => (
          <li key={entry} className="people-chip">
            {entry}
            <button
              type="button"
              aria-label={`Remove ${entry}`}
              onClick={() => onChange(people.filter((other) => other !== entry))}
            >
              <CloseIcon />
            </button>
          </li>
        ))}
        <li className="people-input">
          <input
            aria-label="Add an email or an @domain"
            placeholder={people.length ? "Add another" : "ana@acme.com or @acme.com"}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={keys}
            onBlur={add}
            autoComplete="off"
            spellCheck={false}
          />
        </li>
      </ul>
      {wrong ? <p className="form-error">{wrong}</p> : null}
    </div>
  );
}
