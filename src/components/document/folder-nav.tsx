import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import type { FolderStep, Sibling } from "#/server/library";

/** How many of a folder's documents the side list shows around the one open. */
const AROUND = 9;

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

/** The documents before and after this one in its folder, also reached with [ and ]. */
export function FolderPager({ siblings, current }: { siblings: Sibling[]; current: string }) {
  const navigate = useNavigate();
  const index = siblings.findIndex((entry) => entry.id === current);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 ? siblings[index + 1] : undefined;

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

  if (!previous && !next) return null;
  return (
    <nav aria-label="In this folder" className="folder-pager">
      {previous ? (
        <Link to="/d/$id" params={{ id: previous.id }} rel="prev" aria-keyshortcuts="[">
          <span className="folder-pager-label">Previous</span>
          {previous.title}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to="/d/$id" params={{ id: next.id }} rel="next" aria-keyshortcuts="]">
          <span className="folder-pager-label">Next</span>
          {next.title}
        </Link>
      ) : null}
    </nav>
  );
}
