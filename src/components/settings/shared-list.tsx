import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { DocumentIcon, FolderIcon, PersonIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import { getSharedList, removePerson, updateSharing } from "#/functions/sharing.functions";
import type { SharedEntry } from "#/server/sharing";

const queryKey = ["shared-list"];
const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

/** What the owner shared, and the people who signed in to comment on it. */
export function SharedList() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey, queryFn: () => getSharedList() });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const stop = useMutation({
    mutationFn: (entry: SharedEntry) =>
      updateSharing({
        data: { kind: entry.kind, id: entry.id, permission: null, expiresInDays: null },
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => removePerson({ data: { id } }),
    onSuccess: refresh,
  });

  if (list.isError) return <p className="form-error">{list.error.message}</p>;
  if (!list.data) return null;
  const { items, people } = list.data;

  return (
    <>
      <section aria-labelledby="shared-heading" className="page-section">
        <h2 id="shared-heading">Shared</h2>
        {items.length === 0 ? (
          <p className="page-note">Nothing is shared. Use Share on a document or a folder.</p>
        ) : (
          <ul className="rows">
            {items.map((entry) => (
              <SharedRow
                key={`${entry.kind}:${entry.id}`}
                entry={entry}
                onStop={() => stop.mutateAsync(entry)}
              />
            ))}
          </ul>
        )}
      </section>
      {people.length > 0 ? (
        <section aria-labelledby="people-heading" className="page-section">
          <h2 id="people-heading">People</h2>
          <ul className="rows">
            {people.map((person) => (
              <ConfirmRow
                key={person.id}
                icon={<PersonIcon className="row-icon" />}
                name={<span className="row-signature">{person.name}</span>}
                place={person.email}
                end={<RelativeTime date={new Date(person.joinedAt)} short />}
                action="Remove"
                warning={`${person.name} is signed out and needs a new code to comment again. Their comments stay.`}
                confirm="Remove"
                onConfirm={() => remove.mutateAsync(person.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function SharedRow({ entry, onStop }: { entry: SharedEntry; onStop: () => Promise<unknown> }) {
  const Icon = entry.kind === "folder" ? FolderIcon : DocumentIcon;
  const name =
    entry.kind === "folder" ? (
      <Link to="/f/$id" params={{ id: entry.id }}>
        {entry.name}
      </Link>
    ) : (
      <Link to="/d/$id" params={{ id: entry.id }}>
        {entry.name}
      </Link>
    );
  return (
    <ConfirmRow
      icon={<Icon className="row-icon" />}
      name={name}
      place={entry.permission === "comment" ? "Read and comment" : "Read"}
      end={entry.expiresAt ? <span>until {day.format(new Date(entry.expiresAt))}</span> : null}
      action="Stop sharing"
      warning="The link stops working at once, for everyone who has it."
      confirm="Stop sharing"
      onConfirm={onStop}
    />
  );
}

/** A row with an action that asks once, in the row itself, before it happens. */
function ConfirmRow({
  icon,
  name,
  place,
  end,
  action,
  warning,
  confirm,
  onConfirm,
}: {
  icon: React.ReactNode;
  name: React.ReactNode;
  place: string;
  end: React.ReactNode;
  action: string;
  warning: string;
  confirm: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li>
      <div className="row row-static">
        {icon}
        <span className="row-name">{name}</span>
        <span className="row-place">{place}</span>
        <span className="row-end">
          {end}
          <button
            type="button"
            className="row-action danger"
            aria-expanded={confirming}
            onClick={() => setConfirming(!confirming)}
          >
            {action}
          </button>
        </span>
        {confirming ? (
          <p className="row-confirm" role="alert">
            {warning}
            <button type="button" className="row-action danger" onClick={() => void onConfirm()}>
              {confirm}
            </button>
            <button type="button" className="row-action" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </p>
        ) : null}
      </div>
    </li>
  );
}
