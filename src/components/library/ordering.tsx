import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useId, useState } from "react";

import { DocumentRow } from "#/components/library/rows";
import { CheckIcon, EntryIcon, HandleIcon, OpenMenuIcon, SortIcon } from "#/components/ui/icons";
import { pinEntry, placeItem, sortItems } from "#/functions/organize.functions";
import type { FolderSort } from "#/server/db/schema";
import type { DocumentEntry } from "#/server/library";

const SORTS: { value: FolderSort; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
];

/** After any change of order, every list that shows documents reads them again. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

/** The folder's rule, as a menu beside its other tools. */
export function OrderSelect({ folderId, sort }: { folderId: string; sort: FolderSort }) {
  const menuId = useId();
  const refresh = useRefresh();
  const change = useMutation({
    mutationFn: (next: FolderSort) => sortItems({ data: { folderId, sort: next } }),
    onSettled: refresh,
  });
  const current = change.isPending ? change.variables : sort;
  const label = SORTS.find((option) => option.value === current)?.label;

  function choose(next: FolderSort) {
    document.getElementById(menuId)?.hidePopover();
    if (next !== current) change.mutate(next);
  }

  return (
    <>
      <button type="button" className="order-select" popoverTarget={menuId}>
        <SortIcon />
        <span className="sr-only">Order: </span>
        {label}
        <OpenMenuIcon className="byline-caret" />
      </button>
      <div id={menuId} popover="auto" className="popover menu order-menu" aria-label="Order">
        <ul className="menu-list">
          {SORTS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="menu-item"
                aria-current={option.value === current || undefined}
                onClick={() => choose(option.value)}
              >
                <span className="menu-icon">{option.value === current ? <CheckIcon /> : null}</span>
                <span className="menu-label">{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** The document a folder starts with, shown above the others with its summary. */
export function EntryCard({ entry, folderId }: { entry: DocumentEntry; folderId?: string }) {
  const refresh = useRefresh();
  const unpin = useMutation({
    mutationFn: () => pinEntry({ data: { folderId: folderId ?? "", documentId: null } }),
    onSettled: refresh,
  });
  return (
    <div className="folder-entry">
      <Link to="/d/$id" params={{ id: entry.id }}>
        <span className="folder-entry-label">
          <EntryIcon />
          Start here
        </span>
        <span className="folder-entry-title">{entry.title}</span>
        {entry.summary ? <span className="folder-entry-summary">{entry.summary}</span> : null}
      </Link>
      {folderId ? (
        <button
          type="button"
          className="row-action"
          disabled={unpin.isPending}
          onClick={() => unpin.mutate()}
        >
          Unpin
        </button>
      ) : null}
    </div>
  );
}

/**
 * The folder's documents for its owner: each row has a handle to drag it, which also opens a
 * menu to move it up or down, or pin it as the entry. Changes show at once and save behind.
 */
export function OrderedDocuments({
  folderId,
  documents,
  entryId,
}: {
  folderId: string;
  documents: DocumentEntry[];
  entryId: string | null;
}) {
  const refresh = useRefresh();
  const [moved, setMoved] = useState<string[] | null>(null);
  const place = useMutation({
    mutationFn: (target: { id: string; before: string | null }) => placeItem({ data: target }),
    onSettled: async () => {
      await refresh();
      setMoved(null);
    },
  });
  const pin = useMutation({
    mutationFn: (documentId: string | null) => pinEntry({ data: { folderId, documentId } }),
    onSettled: refresh,
  });

  const byId = new Map(documents.map((entry) => [entry.id, entry]));
  const shown = (moved ?? documents.map((entry) => entry.id))
    .map((id) => byId.get(id))
    .filter((entry) => entry !== undefined);
  const ids = shown.map((entry) => entry.id);

  function move(id: string, before: string | null) {
    const rest = ids.filter((other) => other !== id);
    const at = before === null ? rest.length : rest.indexOf(before);
    rest.splice(at, 0, id);
    setMoved(rest);
    place.mutate({ id, before });
  }

  const [list, setList] = useState<HTMLUListElement | null>(null);
  const over = useDragOrder(list, move);

  return (
    <ul ref={setList} className="rows" data-ordering="">
      {shown.map((entry, index) => (
        <DocumentRow
          key={entry.id}
          entry={entry}
          handle={
            <RowMenu
              title={entry.title}
              entry={entry.id === entryId}
              up={index > 0 ? () => move(entry.id, ids[index - 1] ?? null) : null}
              down={index < ids.length - 1 ? () => move(entry.id, ids[index + 2] ?? null) : null}
              onPin={() => pin.mutate(entry.id === entryId ? null : entry.id)}
            />
          }
        />
      ))}
      {over ? <li className="drop-line" style={{ gridRow: over.row }} aria-hidden /> : null}
    </ul>
  );
}

/**
 * Dragging a row's handle: the line shows where it would land, between rows, and dropping moves
 * it there. The keyboard and touch way is the handle's menu.
 */
function useDragOrder(
  list: HTMLUListElement | null,
  move: (id: string, before: string | null) => void,
) {
  const [over, setOver] = useState<{ row: number } | null>(null);
  const dropped = useEffectEvent(move);

  useEffect(() => {
    if (!list) return undefined;
    const element = list;
    let dragging: string | null = null;
    let before: string | null = null;

    function rows(): HTMLElement[] {
      return [...element.querySelectorAll<HTMLElement>(":scope > li[data-id]")];
    }
    function onStart(event: DragEvent) {
      const handle = event.target instanceof Element && event.target.closest(".row-handle");
      const row = handle ? handle.closest<HTMLElement>("li[data-id]") : null;
      if (!row || !event.dataTransfer) return;
      dragging = row.dataset.id ?? null;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setDragImage(row, 16, 16);
    }
    function onOver(event: DragEvent) {
      if (!dragging) return;
      event.preventDefault();
      const all = rows();
      const index = all.findIndex((row) => {
        const box = row.getBoundingClientRect();
        return event.clientY < box.top + box.height / 2;
      });
      before = index === -1 ? null : (all[index]?.dataset.id ?? null);
      setOver({ row: index === -1 ? all.length + 1 : index + 1 });
    }
    function onEnd() {
      dragging = null;
      setOver(null);
    }
    function onDrop(event: DragEvent) {
      event.preventDefault();
      if (dragging && dragging !== before) dropped(dragging, before);
      onEnd();
    }
    element.addEventListener("dragstart", onStart);
    element.addEventListener("dragover", onOver);
    element.addEventListener("drop", onDrop);
    element.addEventListener("dragend", onEnd);
    return () => {
      element.removeEventListener("dragstart", onStart);
      element.removeEventListener("dragover", onOver);
      element.removeEventListener("drop", onDrop);
      element.removeEventListener("dragend", onEnd);
    };
  }, [list]);

  return over;
}

function RowMenu({
  title,
  entry,
  up,
  down,
  onPin,
}: {
  title: string;
  entry: boolean;
  up: (() => void) | null;
  down: (() => void) | null;
  onPin: () => void;
}) {
  const id = useId();
  const choose = (action: () => void) => () => {
    document.getElementById(id)?.hidePopover();
    action();
  };
  return (
    <>
      <button
        type="button"
        className="row-handle"
        draggable
        popoverTarget={id}
        aria-label={`Order of ${title}`}
        title="Drag to reorder, or click for more"
      >
        <HandleIcon />
      </button>
      <div id={id} popover="auto" className="popover menu row-menu">
        {up ? (
          <button type="button" className="menu-item" onClick={choose(up)}>
            Move up
          </button>
        ) : null}
        {down ? (
          <button type="button" className="menu-item" onClick={choose(down)}>
            Move down
          </button>
        ) : null}
        <button type="button" className="menu-item" onClick={choose(onPin)}>
          {entry ? "Stop starting here" : "Start the folder here"}
        </button>
      </div>
    </>
  );
}
