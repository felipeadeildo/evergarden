import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { BackIcon, ForwardIcon } from "#/components/ui/icons";
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
 * The end of a document in a folder: where it sits in the reading order, the documents before and
 * after it with their summaries, and the whole folder, numbered.
 */
export function FolderEnd({ folder, siblings, current }: Omit<Props, "onNavigate">) {
  const index = siblings.findIndex((entry) => entry.id === current);
  const shown = siblings.slice(0, MAX_LISTED);
  return (
    <nav aria-label={`In ${folder.name}`} className="folder-end">
      <p className="folder-end-place">
        {index + 1} of {siblings.length} in{" "}
        <Link to="/f/$id" params={{ id: folder.id }}>
          {folder.name}
        </Link>
      </p>
      <FolderPager siblings={siblings} current={current} />
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

/** The documents before and after this one in its folder, also reached with [ and ]. */
function FolderPager({ siblings, current }: { siblings: Sibling[]; current: string }) {
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
    <div className="folder-pager">
      {previous ? <PagerCard entry={previous} rel="prev" /> : <span />}
      {next ? <PagerCard entry={next} rel="next" /> : null}
    </div>
  );
}

function PagerCard({ entry, rel }: { entry: Sibling; rel: "prev" | "next" }) {
  const Icon = rel === "prev" ? BackIcon : ForwardIcon;
  return (
    <Link
      to="/d/$id"
      params={{ id: entry.id }}
      rel={rel}
      aria-keyshortcuts={rel === "prev" ? "[" : "]"}
      className="pager-card"
    >
      <span className="pager-card-label">
        {rel === "prev" ? <Icon /> : null}
        {rel === "prev" ? "Previous" : "Next"}
        {rel === "next" ? <Icon /> : null}
      </span>
      <span className="pager-card-title">{entry.title}</span>
      {entry.summary ? <span className="pager-card-summary">{entry.summary}</span> : null}
    </Link>
  );
}
