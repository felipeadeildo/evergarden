import { Link } from "@tanstack/react-router";

import { RelativeTime } from "#/components/ui/relative-time";
import type { DocumentEntry, FolderEntry } from "#/server/library";

function byPosition(a: { position: string }, b: { position: string }): number {
  return a.position < b.position ? -1 : 1;
}

export function DocumentRow({ entry, place }: { entry: DocumentEntry; place?: string }) {
  return (
    <li className="document-row">
      <Link to="/d/$id" params={{ id: entry.id }} className="document-link">
        <span className="document-title">{entry.title}</span>
        <span className="document-meta">
          {place ? <span className="document-place">{place}</span> : null}
          <RelativeTime date={entry.updatedAt} />
        </span>
      </Link>
    </li>
  );
}

/** Folders as native disclosures, documents in the order you arranged them. */
export function LibraryTree({
  folders,
  documents,
}: {
  folders: FolderEntry[];
  documents: DocumentEntry[];
}) {
  function children(parentId: string | null) {
    const childFolders = folders
      .filter((entry) => entry.parentId === parentId)
      .toSorted(byPosition);
    const childDocuments = documents
      .filter((entry) => entry.folderId === parentId)
      .toSorted(byPosition);
    return (
      <ul className="tree" role={parentId ? "group" : undefined}>
        {childFolders.map((entry) => (
          <li key={entry.id} className="folder">
            <details open>
              <summary>
                <span className="folder-name">{entry.name}</span>
                {entry.repo ? <span className="folder-repo">{entry.repo}</span> : null}
              </summary>
              {children(entry.id)}
            </details>
          </li>
        ))}
        {childDocuments.map((entry) => (
          <DocumentRow key={entry.id} entry={entry} />
        ))}
      </ul>
    );
  }
  return children(null);
}

/** "reports/2026" for a document, from the folders it sits in. */
export function placeOf(entry: DocumentEntry, folders: FolderEntry[]): string | undefined {
  const names: string[] = [];
  for (let id = entry.folderId; id;) {
    const folder = folders.find((candidate) => candidate.id === id);
    if (!folder) break;
    names.unshift(folder.name);
    id = folder.parentId;
  }
  return names.length ? names.join("/") : undefined;
}
