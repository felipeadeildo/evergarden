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

/** A folder in the menu's trail; `id: null` is the top of the library. */
type Stop = { id: string | null; name: string };

const LIBRARY: Stop = { id: null, name: "Library" };

/**
 * Where a document or a folder sits, as one control in the top bar. It opens on the last folder
 * of the path; the back button climbs one folder at a time up to the library, and the menu's
 * title opens the folder shown as a page. Phones show only the last folder of the path.
 */
export function FolderPath({ path, documentId }: { path: FolderStep[]; documentId?: string }) {
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const start = [LIBRARY, ...path];
  const [trail, setTrail] = useState<Stop[]>(start);
  const [open, setOpen] = useState(false);

  if (path.length === 0) return null;

  function onToggle(event: ToggleEvent<HTMLDivElement>) {
    const isOpen = event.newState === "open";
    setOpen(isOpen);
    if (!isOpen) setTrail(start);
  }

  return (
    <nav aria-label="Folder" className="folder-path">
      <button type="button" className="folder-path-button" popoverTarget={menuId}>
        {path.map((step, index) => (
          <span key={step.id} className="folder-path-step">
            {index > 0 ? <span className="folder-path-slash">/</span> : null}
            {step.name}
          </span>
        ))}
        <OpenMenuIcon className="folder-path-caret" />
      </button>
      <div id={menuId} ref={menu} popover="auto" className="popover menu" onToggle={onToggle}>
        {open ? (
          <FolderMenu
            trail={trail}
            onPath={(id) => path.some((step) => step.id === id)}
            documentId={documentId}
            onEnter={(stop) => setTrail([...trail, stop])}
            onBack={() => setTrail(trail.slice(0, -1))}
            onLeave={() => menu.current?.hidePopover()}
          />
        ) : null}
      </div>
    </nav>
  );
}

function FolderMenu({
  trail,
  onPath,
  documentId,
  onEnter,
  onBack,
  onLeave,
}: {
  trail: Stop[];
  /** Whether a folder holds the document, so the menu can mark the way back to it. */
  onPath: (id: string) => boolean;
  documentId?: string;
  onEnter: (stop: Stop) => void;
  onBack: () => void;
  /** Closes the menu when one of its links navigates away. */
  onLeave: () => void;
}) {
  const current = trail.at(-1) ?? LIBRARY;
  const parent = trail.at(-2);
  const folder = useFolder(current.id);

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
        {current.id ? (
          <Link to="/f/$id" params={{ id: current.id }} className="menu-title" onClick={onLeave}>
            {current.name}
          </Link>
        ) : (
          <Link to="/" className="menu-title" onClick={onLeave}>
            {current.name}
          </Link>
        )}
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
                aria-current={onPath(entry.id) ? "true" : undefined}
                onClick={() => onEnter({ id: entry.id, name: entry.name })}
              >
                <FolderIcon className="menu-icon" />
                <span className="menu-label">{entry.name}</span>
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
                onClick={onLeave}
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
