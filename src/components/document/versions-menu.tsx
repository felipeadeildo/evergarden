import { Link } from "@tanstack/react-router";
import { useId, useRef } from "react";

import { CheckIcon, HistoryIcon, OpenMenuIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import type { VersionEntry } from "#/server/library";

export function VersionsMenu({
  documentId,
  versions,
  shown,
}: {
  documentId: string;
  versions: VersionEntry[];
  shown: number;
}) {
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const latest = versions[0];
  if (!latest) return null;

  const byline = (
    <>
      <HistoryIcon />
      <span>
        {latest.number === 1 ? "Written" : "Updated"} <RelativeTime date={latest.createdAt} /> by{" "}
        <span className="byline-author">{latest.authorName}</span>
      </span>
    </>
  );

  if (versions.length === 1) return <p className="byline byline-text">{byline}</p>;

  return (
    <div className="byline">
      <button type="button" className="byline-button" popoverTarget={menuId}>
        {byline}
        <OpenMenuIcon className="byline-caret" />
      </button>
      <div id={menuId} ref={menu} popover="auto" className="popover menu" aria-label="Versions">
        <ol className="menu-list">
          {versions.map((entry) => (
            <li key={entry.number}>
              <Link
                to="/d/$id"
                params={{ id: documentId }}
                search={entry.number === latest.number ? {} : { v: entry.number }}
                className="menu-item"
                aria-current={entry.number === shown ? "page" : undefined}
                onClick={() => menu.current?.hidePopover()}
              >
                <span className="menu-icon">{entry.number === shown ? <CheckIcon /> : null}</span>
                <span className="menu-label">Version {entry.number}</span>
                <span className="menu-detail">
                  {entry.authorName}, <RelativeTime date={entry.createdAt} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
