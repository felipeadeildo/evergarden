import { Link } from "@tanstack/react-router";

import { DocumentIcon, FolderIcon, RepositoryIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import type { DocumentEntry, FolderSummary } from "#/server/library";

/*
 * Every list in the library uses one row: an icon level with the first line, the name, and a
 * quieter line of details under it. Names and details share one left edge whatever their length.
 */

/** A document: its title, then whether it changed since you read it, where it sits, and when. */
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
      <Link to="/d/$id" params={{ id: entry.id }} className="row">
        <DocumentIcon className="row-icon" />
        <span className="row-name">{entry.title}</span>
        <span className="row-details">
          {unread ? (
            <span className="row-unread">
              <span className="sr-only">Changed since you read it</span>
            </span>
          ) : null}
          {place ? <span className="row-place">{place}</span> : null}
          <RelativeTime date={entry.updatedAt} />
        </span>
      </Link>
    </li>
  );
}

/** A folder: its name, then how many documents it holds and the repository it is linked to. */
export function FolderRow({ entry }: { entry: FolderSummary }) {
  return (
    <li>
      <Link to="/f/$id" params={{ id: entry.id }} className="row">
        <FolderIcon className="row-icon" />
        <span className="row-name row-folder">{entry.name}</span>
        <span className="row-details">
          <span>{entry.documents === 1 ? "1 document" : `${entry.documents} documents`}</span>
          {entry.repo ? <span className="row-repo">{entry.repo}</span> : null}
        </span>
      </Link>
    </li>
  );
}

/** The repository a folder is linked to, opening it on its host. */
export function RepositoryLink({ repo }: { repo: string }) {
  return (
    <a className="repository" href={`https://${repo}`} target="_blank" rel="noreferrer">
      <RepositoryIcon />
      {repo}
    </a>
  );
}
