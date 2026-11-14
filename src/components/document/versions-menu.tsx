import { Link } from "@tanstack/react-router";
import { useId, useRef } from "react";

import { CheckIcon, HistoryIcon, OpenMenuIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import type { VersionEntry } from "#/server/library";

/** "Updated 2 hours ago by pi", opening the list of versions to read an older one. */
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

  return (
    <div className="byline">
      <button type="button" className="byline-button" popoverTarget={menuId}>
        <HistoryIcon />
        <span>
          {latest.number === 1 ? "Written" : "Updated"} <RelativeTime date={latest.createdAt} /> by{" "}
          {latest.authorName}
        </span>
        <OpenMenuIcon className="byline-caret" />
      </button>
      <div id={menuId} ref={menu} popover="auto" className="popover menu">
        <div className="menu-header">
          <p className="menu-title">
            {versions.length === 1 ? "One version" : `${versions.length} versions`}
          </p>
        </div>
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
                <span className="menu-label">
                  Version {entry.number}
                  {entry.number === latest.number ? (
                    <span className="menu-tag">current</span>
                  ) : null}
                </span>
                <span className="menu-detail menu-detail-below">
                  <RelativeTime date={entry.createdAt} /> by {entry.authorName}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {versions.length === 1 ? (
          <p className="menu-note">Each update an agent publishes adds a version here.</p>
        ) : null}
      </div>
    </div>
  );
}
