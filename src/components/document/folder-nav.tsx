import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { ForwardIcon } from "#/components/ui/icons";
import type { FolderStep, Sibling } from "#/server/library";

/** How many of a folder's documents the side list shows around the one open. */
const AROUND = 9;

/** How many of a folder's documents the end of a document lists before linking to the folder. */
const MAX_LISTED = 30;

type Props = { folder: FolderStep; siblings: Sibling[]; current: string; onNavigate?: () => void };

/** The folder's documents beside the text, like a docs site's sidebar. */
export function FolderNav({ folder, siblings, current, onNavigate }: Props) {
  const index = siblings.findIndex((entry) => entry.id === current);
  const start = Math.max(0, Math.min(index - Math.floor(AROUND / 2), siblings.length - AROUND));
  const shown = siblings.slice(start, start + AROUND);
  return (
    <nav aria-label={`In ${folder.name}`} className="toc folder-nav">
      <Link
        to="/f/$id"
        params={{ id: folder.id }}
        className="folder-nav-title"
        onClick={onNavigate}
      >
        {folder.name}
      </Link>
      <ol>
        {shown.map((entry) => (
          <li key={entry.id}>
            <Link
              to="/d/$id"
              params={{ id: entry.id }}
              aria-current={entry.id === current ? "page" : undefined}
              onClick={onNavigate}
            >
              {entry.title}
            </Link>
          </li>
        ))}
      </ol>
      {shown.length < siblings.length ? (
        <Link
          to="/f/$id"
          params={{ id: folder.id }}
          className="folder-nav-all"
          onClick={onNavigate}
        >
          All {siblings.length} documents
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * The end of a document in a folder: the next one to read, then the whole folder, numbered, with
 * this one marked. `[` and `]` open the documents before and after it.
 */
export function FolderEnd({ folder, siblings, current }: Omit<Props, "onNavigate">) {
  const index = siblings.findIndex((entry) => entry.id === current);
  const next = index >= 0 ? siblings[index + 1] : undefined;
  const shown = siblings.slice(0, MAX_LISTED);
  useNeighbourKeys(siblings[index - 1], next);

  return (
    <nav aria-label={`In ${folder.name}`} className="folder-end">
      {next ? <NextCard entry={next} /> : null}
      <p className="folder-end-place">
        <Link to="/f/$id" params={{ id: folder.id }}>
          {folder.name}
        </Link>
        , {index + 1} of {siblings.length}
      </p>
      <ol className="folder-end-list">
        {shown.map((entry, position) => (
          <li key={entry.id}>
            <Link
              to="/d/$id"
              params={{ id: entry.id }}
              aria-current={entry.id === current ? "page" : undefined}
            >
              <span className="folder-end-number">{position + 1}</span>
              <span className="folder-end-title">{entry.title}</span>
            </Link>
          </li>
        ))}
      </ol>
      {shown.length < siblings.length ? (
        <Link to="/f/$id" params={{ id: folder.id }} className="folder-end-all">
          All {siblings.length} documents in {folder.name}
        </Link>
      ) : null}
    </nav>
  );
}

function useNeighbourKeys(previous: Sibling | undefined, next: Sibling | undefined) {
  const navigate = useNavigate();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const typing =
        event.target instanceof Element &&
        event.target.closest("input, textarea, [contenteditable], dialog");
      if (typing) return;
      const to = { "[": previous, "]": next }[event.key];
      if (to) void navigate({ to: "/d/$id", params: { id: to.id } });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, previous, next]);
}

function NextCard({ entry }: { entry: Sibling }) {
  return (
    <Link
      to="/d/$id"
      params={{ id: entry.id }}
      rel="next"
      aria-keyshortcuts="]"
      className="next-card"
    >
      <span className="next-card-label">
        Next
        <ForwardIcon />
      </span>
      <span className="next-card-title">{entry.title}</span>
      {entry.summary ? <span className="next-card-summary">{entry.summary}</span> : null}
    </Link>
  );
}
