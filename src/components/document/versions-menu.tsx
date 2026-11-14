import { Link } from "@tanstack/react-router";

import { RelativeTime } from "#/components/ui/relative-time";
import type { VersionEntry } from "#/server/library";

/** "Updated 2 hours ago by pi", opening the list of versions. */
export function VersionsMenu({
  documentId,
  versions,
  shown,
}: {
  documentId: string;
  versions: VersionEntry[];
  shown: number;
}) {
  const latest = versions[0];
  if (!latest) return null;
  const menuId = "versions-menu";

  return (
    <div className="byline">
      <button type="button" className="byline-button" popoverTarget={menuId}>
        {latest.number === 1 ? "Written" : "Updated"} <RelativeTime date={latest.createdAt} /> by{" "}
        {latest.authorName}
        {versions.length > 1 ? (
          <span className="byline-count">, version {latest.number}</span>
        ) : null}
      </button>
      <div id={menuId} popover="auto" className="popover versions">
        <p className="popover-title">Versions</p>
        <ol>
          {versions.map((entry) => (
            <li key={entry.number}>
              <Link
                to="/d/$id"
                params={{ id: documentId }}
                search={entry.number === latest.number ? {} : { v: entry.number }}
                aria-current={entry.number === shown ? "page" : undefined}
              >
                <span className="versions-number">Version {entry.number}</span>
                <span className="versions-meta">
                  <RelativeTime date={entry.createdAt} /> by {entry.authorName}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
