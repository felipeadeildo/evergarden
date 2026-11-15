import { type ReactNode, useRef, useState } from "react";

import {
  CommentsEnd,
  CommentsProvider,
  CommentsSheet,
  SelectionBar,
  useComments,
} from "#/components/comments/comments";
import { CommentsMargin } from "#/components/comments/margin";
import { CommentPins } from "#/components/comments/pins";
import { DocumentBody } from "#/components/document/body";
import { Contents } from "#/components/document/contents";
import { TopBar } from "#/components/navigation/top-bar";
import { CommentIcon, ContentsIcon } from "#/components/ui/icons";
import { Page, PageHeader } from "#/components/ui/page";
import { Sheet } from "#/components/ui/sheet";
import type { DocumentPage } from "#/server/library";

/**
 * A document as it is read: its contents, its text and, on the current version, its comments.
 * The library page and a share link wrap it in their own top bar and byline.
 */
export function DocumentView({
  page,
  place,
  actions,
  shared,
  byline,
  notice,
  comments,
}: {
  page: DocumentPage;
  /** Where the document sits, in the top bar. */
  place: ReactNode;
  /** More buttons for the top bar, after the document's own. */
  actions?: ReactNode;
  shared?: { home: string };
  byline: ReactNode;
  /** Shown above the title, such as the note on an older version. */
  notice?: ReactNode;
  /** Comments show only when given; new ones go on the current version alone. */
  comments?: {
    active: string | null;
    setActive: (id: string | null) => void;
    moderate: boolean;
  } | null;
}) {
  const { document, version, body, source } = page;
  const [contentsOpen, setContentsOpen] = useState(false);
  const text = useRef<HTMLDivElement>(null);
  const hasContents = body.headings.length > 1;
  const commenting = Boolean(comments);
  const writable = version.number === document.version;

  const contentsButton = hasContents ? (
    <button
      type="button"
      className="quiet-button contents-toggle"
      onClick={() => setContentsOpen(true)}
    >
      <ContentsIcon />
      <span className="label">Contents</span>
    </button>
  ) : null;

  const view = (
    <>
      <TopBar
        shared={shared}
        actions={
          <>
            {commenting ? <CommentsButton /> : null}
            {contentsButton}
            {actions}
          </>
        }
      >
        {place}
      </TopBar>
      <Page
        aside={hasContents ? <Contents headings={body.headings} /> : null}
        margin={commenting ? <CommentsMargin /> : null}
      >
        {notice}
        <PageHeader title={document.title}>{byline}</PageHeader>
        <div className="document-text">
          <div ref={text}>
            <DocumentBody tree={body.tree} />
          </div>
          {commenting ? <CommentPins /> : null}
        </div>
        {commenting ? <CommentsEnd /> : null}
      </Page>
      <Sheet open={contentsOpen} onClose={() => setContentsOpen(false)} label="Contents">
        <Contents headings={body.headings} onNavigate={() => setContentsOpen(false)} />
      </Sheet>
      {commenting && writable ? <SelectionBar /> : null}
      {commenting ? <CommentsSheet /> : null}
    </>
  );

  if (!commenting || !comments) return view;
  return (
    <CommentsProvider
      key={version.number}
      documentId={document.id}
      version={version.number}
      source={source}
      root={text}
      active={comments.active}
      setActive={comments.setActive}
      moderate={comments.moderate}
      writable={writable}
    >
      {view}
    </CommentsProvider>
  );
}

/** On a phone, where there is no margin, opens the first comment. */
function CommentsButton() {
  const { shown, setActive, writable } = useComments();
  if (shown.length === 0) return null;
  const label = `${shown.length} ${writable ? "open" : "resolved"} comments`;
  return (
    <button
      type="button"
      className="quiet-button comments-button"
      aria-label={label}
      onClick={() => setActive(shown[0]!.id)}
    >
      <CommentIcon />
      <span aria-hidden>{shown.length}</span>
    </button>
  );
}
