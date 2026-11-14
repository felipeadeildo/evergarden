import { Link } from "@tanstack/react-router";
import { type ToggleEvent, useId, useRef, useState } from "react";

import { LoadMore } from "#/components/library/rows";
import { useFolder } from "#/components/library/use-folder";
import {
  BackIcon,
  DocumentIcon,
  FolderIcon,
  ForwardIcon,
  OpenMenuIcon,
} from "#/components/ui/icons";
import type { FolderStep } from "#/server/library";

type Stop = { id: string | null; name: string };

const LIBRARY: Stop = { id: null, name: "Library" };

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
            isOnPath={(id) => path.some((step) => step.id === id)}
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
  isOnPath,
  documentId,
  onEnter,
  onBack,
  onLeave,
}: {
  trail: Stop[];
  isOnPath: (id: string) => boolean;
  documentId?: string;
  onEnter: (stop: Stop) => void;
  onBack: () => void;
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
                aria-current={isOnPath(entry.id) ? "true" : undefined}
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
              <LoadMore folder={folder} />
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}
