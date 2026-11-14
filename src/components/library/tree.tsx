import { Link } from "@tanstack/react-router";

import { DocumentIcon, FolderIcon, RepositoryIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import type { DocumentEntry, FolderPage, FolderSummary } from "#/server/library";

import { useOpenFolders } from "./open-folders";
import { useFolder } from "./use-folder";

type OpenFolders = ReturnType<typeof useOpenFolders>;

export function DocumentRow({ entry, place }: { entry: DocumentEntry; place?: string | null }) {
  return (
    <li className="document-row">
      <Link to="/d/$id" params={{ id: entry.id }} className="document-link">
        <span className="document-title">
          <DocumentIcon className="document-icon" />
          {entry.title}
        </span>
        <span className="document-meta">
          {place ? <span className="document-place">{place}</span> : null}
          <RelativeTime date={entry.updatedAt} />
        </span>
      </Link>
    </li>
  );
}

/**
 * The library as folders that load what they hold when opened. The top level arrives with the
 * page; each folder asks for its own contents once, and long folders show documents in pages.
 */
export function LibraryTree({ root }: { root: FolderPage }) {
  const open = useOpenFolders();
  return <FolderItems folderId={null} first={root} open={open} />;
}

function FolderItems({
  folderId,
  first,
  open,
}: {
  folderId: string | null;
  first?: FolderPage;
  open: OpenFolders;
}) {
  const folder = useFolder(folderId, first);

  if (folder.state === "loading") return <p className="tree-note">Opening…</p>;
  if (folder.state === "failed") {
    return (
      <p className="tree-note">
        This folder did not open.{" "}
        <button type="button" className="link-button" onClick={folder.retry}>
          Try again
        </button>
      </p>
    );
  }

  const { folders, documents, more } = folder;
  if (folders.length === 0 && documents.length === 0) {
    return <p className="tree-note">Nothing here yet.</p>;
  }

  return (
    <ul className="tree" role={folderId ? "group" : undefined}>
      {folders.map((entry) => (
        <FolderRow key={entry.id} entry={entry} open={open} />
      ))}
      {documents.map((entry) => (
        <DocumentRow key={entry.id} entry={entry} />
      ))}
      {more > 0 ? (
        <li className="tree-more">
          <button
            type="button"
            className="link-button"
            disabled={folder.loadingMore}
            onClick={folder.loadMore}
          >
            {folder.loadingMore ? "Loading…" : `Show ${Math.min(more, 50)} more of ${more}`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function FolderRow({ entry, open }: { entry: FolderSummary; open: OpenFolders }) {
  const isOpen = open.isOpen(entry.id);
  return (
    <li className="folder">
      <details open={isOpen} onToggle={(event) => open.setOpen(entry.id, event.currentTarget.open)}>
        <summary>
          <FolderIcon className="folder-icon" />
          <span className="folder-name">{entry.name}</span>
          {entry.repo ? (
            <span className="folder-repo">
              <RepositoryIcon />
              {entry.repo}
            </span>
          ) : null}
          <span className="folder-count" aria-label={`${entry.items} items`}>
            {entry.items}
          </span>
        </summary>
        {isOpen ? <FolderItems folderId={entry.id} open={open} /> : null}
      </details>
    </li>
  );
}
