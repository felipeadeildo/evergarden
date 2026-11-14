import { Link } from "@tanstack/react-router";

import { DocumentIcon, FolderIcon, RepositoryIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import { FOLDER_PAGE_SIZE, plural } from "#/lib/text";
import type { DocumentEntry, FolderSummary } from "#/server/library";

import type { ReadyFolder } from "./use-folder";

// The rows of a list share their columns (subgrid), so names, places and times line up.

export function DocumentRow({
  entry,
  place,
  unread = false,
}: {
  entry: DocumentEntry;
  place?: string | null;
  unread?: boolean;
}) {
  return (
    <li>
      <Link
        to="/d/$id"
        params={{ id: entry.id }}
        className="row"
        data-unread={unread || undefined}
        title={entry.title}
      >
        <DocumentIcon className="row-icon" />
        <span className="row-name">{entry.title}</span>
        <span className="row-place">{place}</span>
        <span className="row-end">
          {unread ? <span className="sr-only">Changed since you read it, </span> : null}
          <RelativeTime date={entry.updatedAt} short />
        </span>
      </Link>
    </li>
  );
}

export function FolderRow({ entry }: { entry: FolderSummary }) {
  return (
    <li>
      <Link to="/f/$id" params={{ id: entry.id }} className="row">
        <FolderIcon className="row-icon" />
        <span className="row-name row-folder">{entry.name}</span>
        <span className="row-place row-repo">{entry.repo}</span>
        <span className="row-end" title={plural(entry.documents, "document")}>
          {entry.documents}
        </span>
      </Link>
    </li>
  );
}

export function RepositoryLink({ repo }: { repo: string }) {
  return (
    <a className="repository" href={`https://${repo}`} target="_blank" rel="noreferrer">
      <RepositoryIcon />
      {repo}
    </a>
  );
}

export function LoadMore({ folder }: { folder: ReadyFolder }) {
  if (folder.more === 0) return null;
  return (
    <button
      type="button"
      className="link-button"
      disabled={folder.loadingMore}
      onClick={folder.loadMore}
    >
      {folder.loadingMore ? "Loading…" : `Show ${Math.min(folder.more, FOLDER_PAGE_SIZE)} more`}
    </button>
  );
}
