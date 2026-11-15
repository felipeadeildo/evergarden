import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { EditIcon, FolderIcon, MoveIcon, TrashIcon } from "#/components/ui/icons";
import { Sheet } from "#/components/ui/sheet";
import {
  deleteItem,
  type FolderChoice,
  getFolders,
  moveItem,
  renameItem,
} from "#/functions/organize.functions";

export type Subject = { kind: "document" | "folder"; id: string };

type Props = {
  subject: Subject;
  /** The document's title or the folder's name. */
  name: string;
  /** The folder it sits in; null at the top of the library. */
  parentId: string | null;
};

type Open = "rename" | "move" | "delete" | null;

/** A folder by id (`null` is the top of the library), or a new one by path. */
type Destination = { id: string | null } | { path: string };

/** Rename, move and delete, for the owner, beside a document's or folder's title. */
export function OrganizeTools(props: Props) {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  return (
    <div className="tool-row">
      <button type="button" onClick={() => setOpen("rename")}>
        <EditIcon />
        Rename
      </button>
      <button type="button" onClick={() => setOpen("move")}>
        <MoveIcon />
        Move
      </button>
      <button type="button" onClick={() => setOpen("delete")}>
        <TrashIcon />
        Delete
      </button>
      <Sheet open={open === "rename"} onClose={close} label="Rename" className="organize-sheet">
        <RenameForm {...props} onDone={close} />
      </Sheet>
      <Sheet open={open === "move"} onClose={close} label="Move" className="organize-sheet">
        <MoveForm {...props} onDone={close} />
      </Sheet>
      <Sheet open={open === "delete"} onClose={close} label="Delete" className="organize-sheet">
        <DeleteForm {...props} onDone={close} />
      </Sheet>
    </div>
  );
}

/** After a change, every list and page that shows the item reads it again. */
function useRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    await queryClient.invalidateQueries();
    await router.invalidate();
  };
}

function RenameForm({ subject, name, onDone }: Props & { onDone: () => void }) {
  const [value, setValue] = useState(name);
  const refresh = useRefresh();
  const rename = useMutation({
    mutationFn: () => renameItem({ data: { ...subject, name: value } }),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });
  const changed = value.trim() !== "" && value.trim() !== name;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (changed) rename.mutate();
  }

  return (
    <form className="access-form" onSubmit={submit}>
      <h2 className="access-title">Rename</h2>
      <label className="field">
        <span>{subject.kind === "folder" ? "Folder name" : "Title"}</span>
        <input
          value={value}
          maxLength={subject.kind === "folder" ? 100 : 200}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      </label>
      {subject.kind === "document" ? (
        <p className="access-note">The new title goes into the markdown as a new version.</p>
      ) : null}
      <Failure error={rename.error} />
      <Actions onCancel={onDone} disabled={!changed || rename.isPending}>
        {rename.isPending ? "Renaming…" : "Rename"}
      </Actions>
    </form>
  );
}

type Place = { id: string | null; name: string; path: string; depth: number };

/** The folders as an indented tree, without `skip` and what it holds. */
function placesOf(folders: FolderChoice[], skip: string | null): Place[] {
  const children = new Map<string | null, FolderChoice[]>();
  for (const entry of folders) {
    children.set(entry.parentId, [...(children.get(entry.parentId) ?? []), entry]);
  }
  const places: Place[] = [{ id: null, name: "Top of the library", path: "", depth: 0 }];
  function walk(parentId: string | null, depth: number, above: string) {
    for (const entry of children.get(parentId) ?? []) {
      if (entry.id === skip) continue;
      const path = above ? `${above}/${entry.name}` : entry.name;
      places.push({ id: entry.id, name: entry.name, path, depth });
      walk(entry.id, depth + 1, path);
    }
  }
  walk(null, 0, "");
  return places;
}

function MoveForm({ subject, name, parentId, onDone }: Props & { onDone: () => void }) {
  const folders = useQuery({ queryKey: ["folders"], queryFn: () => getFolders() });
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState<Destination | null>(null);
  const refresh = useRefresh();
  const move = useMutation({
    mutationFn: (to: Destination) => moveItem({ data: { ...subject, to } }),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });

  const places = placesOf(folders.data ?? [], subject.kind === "folder" ? subject.id : null);
  const wanted = filter.trim().replace(/^\/+|\/+$/g, "");
  const shown = wanted
    ? places.filter((place) => place.path.toLowerCase().includes(wanted.toLowerCase()))
    : places;
  const isNew = wanted !== "" && !places.some((place) => place.path === wanted);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (choice) move.mutate(choice);
  }

  return (
    <form className="access-form" onSubmit={submit}>
      <h2 className="access-title">Move "{name}"</h2>
      <label className="field">
        <span>Find a folder, or type a new path</span>
        <input
          type="search"
          spellCheck={false}
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
        />
      </label>
      <fieldset className="folder-picker">
        <legend className="sr-only">Move to</legend>
        {shown.map((place) => {
          const here = place.id === parentId;
          return (
            <label
              key={place.id ?? "top"}
              style={{ paddingInlineStart: `${0.6 + (wanted ? 0 : place.depth) * 1.1}rem` }}
            >
              <input
                type="radio"
                name="to"
                disabled={here}
                checked={choice !== null && "id" in choice && choice.id === place.id}
                onChange={() => setChoice({ id: place.id })}
              />
              <FolderIcon />
              <span className="folder-picker-name">
                {wanted ? place.path || place.name : place.name}
              </span>
              {here ? <span className="folder-picker-here">Here now</span> : null}
            </label>
          );
        })}
        {isNew ? (
          <label>
            <input
              type="radio"
              name="to"
              checked={choice !== null && "path" in choice && choice.path === wanted}
              onChange={() => setChoice({ path: wanted })}
            />
            <FolderIcon />
            <span className="folder-picker-name">New folder {wanted}</span>
          </label>
        ) : null}
        {folders.isPending ? <p className="access-note">Loading folders…</p> : null}
      </fieldset>
      <Failure error={move.error ?? folders.error} />
      <Actions onCancel={onDone} disabled={!choice || move.isPending}>
        {move.isPending ? "Moving…" : "Move"}
      </Actions>
    </form>
  );
}

function DeleteForm({ subject, name, parentId, onDone }: Props & { onDone: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteItem({ data: subject }),
    onSuccess: async () => {
      onDone();
      await (parentId
        ? navigate({ to: "/f/$id", params: { id: parentId } })
        : navigate({ to: "/" }));
      await queryClient.invalidateQueries();
    },
  });
  const what = subject.kind === "folder" ? "The folder and everything in it" : "The document";
  return (
    <form
      className="access-form"
      onSubmit={(event) => {
        event.preventDefault();
        remove.mutate();
      }}
    >
      <h2 className="access-title">Delete "{name}"</h2>
      <p className="access-note">
        {what} goes to the trash and stops being shared. You can restore it from Settings for 30
        days.
      </p>
      <Failure error={remove.error} />
      <Actions onCancel={onDone} disabled={remove.isPending} danger>
        {remove.isPending ? "Deleting…" : "Move to trash"}
      </Actions>
    </form>
  );
}

function Failure({ error }: { error: Error | null }) {
  return error ? (
    <p role="alert" className="form-error">
      {error.message}
    </p>
  ) : null;
}

function Actions({
  onCancel,
  disabled,
  danger = false,
  children,
}: {
  onCancel: () => void;
  disabled: boolean;
  danger?: boolean;
  children: string;
}) {
  return (
    <div className="access-actions">
      <button type="button" className="quiet-button" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className={danger ? "button danger" : "button"} disabled={disabled}>
        {children}
      </button>
    </div>
  );
}
