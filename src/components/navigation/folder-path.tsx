import { Link } from "@tanstack/react-router";
import { type ToggleEvent, useId, useRef, useState } from "react";

import { useFolder } from "#/components/library/use-folder";
import {
  BackIcon,
  DocumentIcon,
  FolderIcon,
  ForwardIcon,
  OpenMenuIcon,
} from "#/components/ui/icons";
import type { FolderStep } from "#/server/library";

/**
 * Where a document sits, as a path in the top bar. Each folder opens a menu of what it holds,
 * where you can go into other folders and open another document. Phones show the last folder.
 */
export function FolderPath({ path, documentId }: { path: FolderStep[]; documentId: string }) {
  if (path.length === 0) return null;
  return (
    <nav aria-label="Folder" className="folder-path">
      <ol>
        {path.map((step, index) => (
          <li key={step.id}>
            <FolderMenu path={path} trail={path.slice(0, index + 1)} documentId={documentId} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** One folder of the path and its menu. `trail` runs from the top folder down to this one. */
function FolderMenu({
  path,
  trail,
  documentId,
}: {
  path: FolderStep[];
  trail: FolderStep[];
  documentId: string;
}) {
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(trail);
  const folder = trail.at(-1);
  if (!folder) return null;

  function onToggle(event: ToggleEvent<HTMLDivElement>) {
    const isOpen = event.newState === "open";
    setOpen(isOpen);
    if (!isOpen) setShown(trail);
  }

  return (
    <>
      <button type="button" className="folder-path-button" popoverTarget={menuId}>
        {folder.name}
        <OpenMenuIcon className="folder-path-caret" />
      </button>
      <div id={menuId} ref={menu} popover="auto" className="popover menu" onToggle={onToggle}>
        {open ? (
          <FolderMenuContents
            shown={shown}
            path={path}
            documentId={documentId}
            onEnter={(step) => setShown([...shown, step])}
            onBack={() => setShown(shown.slice(0, -1))}
            onOpenDocument={() => menu.current?.hidePopover()}
          />
        ) : null}
      </div>
    </>
  );
}

function FolderMenuContents({
  shown,
  path,
  documentId,
  onEnter,
  onBack,
  onOpenDocument,
}: {
  shown: FolderStep[];
  /** The folders the document sits in, marked in the menu. */
  path: FolderStep[];
  documentId: string;
  onEnter: (step: FolderStep) => void;
  onBack: () => void;
  onOpenDocument: () => void;
}) {
  const current = shown.at(-1);
  const parent = shown.at(-2);
  const folder = useFolder(current?.id ?? null);

  return (
    <>
      <div className="menu-header">
        {parent ? (
          <button
            type="button"
            className="menu-back"
            onClick={onBack}
            aria-label={`Back to ${parent.name}`}
          >
            <BackIcon />
          </button>
        ) : null}
        <p className="menu-title">{current?.name}</p>
      </div>
      {folder.state === "loading" ? <p className="menu-note">Opening…</p> : null}
      {folder.state === "failed" ? (
        <p className="menu-note">
          This folder did not open.{" "}
          <button type="button" className="link-button" onClick={folder.retry}>
            Try again
          </button>
        </p>
      ) : null}
      {folder.state === "ready" ? (
        <ul className="menu-list">
          {folder.folders.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="menu-item"
                aria-current={path.some((step) => step.id === entry.id) ? "true" : undefined}
                onClick={() => onEnter({ id: entry.id, name: entry.name })}
              >
                <FolderIcon className="menu-icon" />
                <span className="menu-label">{entry.name}</span>
                <span className="menu-detail">{entry.items}</span>
                <ForwardIcon className="menu-icon" />
              </button>
            </li>
          ))}
          {folder.documents.map((entry) => (
            <li key={entry.id}>
              <Link
                to="/d/$id"
                params={{ id: entry.id }}
                className="menu-item"
                aria-current={entry.id === documentId ? "page" : undefined}
                onClick={onOpenDocument}
              >
                <DocumentIcon className="menu-icon" />
                <span className="menu-label">{entry.title}</span>
              </Link>
            </li>
          ))}
          {folder.more > 0 ? (
            <li className="menu-note">
              <button
                type="button"
                className="link-button"
                disabled={folder.loadingMore}
                onClick={folder.loadMore}
              >
                {folder.loadingMore ? "Loading…" : `Show ${Math.min(folder.more, 50)} more`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}
