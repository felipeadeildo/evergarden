import { Link } from "@tanstack/react-router";
import { useId, useMemo, useRef } from "react";

import { useMaybeComments } from "#/components/comments/comments";
import type { Thread } from "#/components/comments/use-threads";
import { CheckIcon, CommentIcon, HistoryIcon, OpenMenuIcon } from "#/components/ui/icons";
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
  const resolved = useResolved();
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

  if (versions.length === 1 && !resolved.has(latest.number)) {
    return <p className="byline byline-text">{byline}</p>;
  }
  const close = () => menu.current?.hidePopover();

  return (
    <div className="byline">
      <button type="button" className="byline-button" popoverTarget={menuId}>
        {byline}
        <OpenMenuIcon className="byline-caret" />
      </button>
      <div
        id={menuId}
        ref={menu}
        popover="auto"
        className="popover menu versions-menu"
        aria-label="Versions"
      >
        <ol className="menu-list">
          {versions.map((entry) => {
            const at = entry.number === latest.number ? {} : { v: entry.number };
            const threads = resolved.get(entry.number) ?? [];
            return (
              <li key={entry.number}>
                <Link
                  to="/d/$id"
                  params={{ id: documentId }}
                  search={at}
                  className="menu-item"
                  aria-current={entry.number === shown ? "page" : undefined}
                  onClick={close}
                >
                  <span className="menu-icon">{entry.number === shown ? <CheckIcon /> : null}</span>
                  <span className="menu-label">Version {entry.number}</span>
                  <span className="menu-detail">
                    {entry.authorName}, <RelativeTime date={entry.createdAt} />
                  </span>
                </Link>
                {threads.length > 0 ? (
                  <ol className="menu-list resolved-list" aria-label="Resolved on this version">
                    {threads.map((thread) => (
                      <li key={thread.id}>
                        <Link
                          to="/d/$id"
                          params={{ id: documentId }}
                          search={{ ...at, c: thread.id }}
                          className="menu-item resolved-item"
                          onClick={close}
                        >
                          <CommentIcon className="menu-icon" />
                          <span className="menu-label">{thread.body}</span>
                          <span className="menu-detail">{thread.author.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** The resolved threads of each version, for readers who see comments. */
function useResolved(): Map<number, Thread[]> {
  const threads = useMaybeComments()?.threads;
  return useMemo(() => {
    const byVersion = new Map<number, Thread[]>();
    for (const thread of threads ?? []) {
      if (thread.status !== "resolved") continue;
      byVersion.set(thread.version, [...(byVersion.get(thread.version) ?? []), thread]);
    }
    return byVersion;
  }, [threads]);
}
