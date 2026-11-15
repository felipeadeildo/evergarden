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
import { ExportTools } from "#/components/document/export-tools";
import { FileList, FilesProvider } from "#/components/document/files";
import { FolderNav, FolderPager } from "#/components/document/folder-nav";
import { type DocumentLinks, LinksProvider } from "#/components/document/links";
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
  tools,
  filesAt,
  canAttach = false,
  comments,
}: {
  page: DocumentPage & { links?: DocumentLinks };
  /** Where the document sits, in the top bar. */
  place: ReactNode;
  /** More buttons for the top bar, after the document's own. */
  actions?: ReactNode;
  shared?: { home: string };
  byline: ReactNode;
  /** The owner's tools beside the export ones, such as rename and move. */
  tools?: ReactNode;
  /** Whose files the text points at: the version shown, or the owner's draft. */
  filesAt?: number | "draft";
  /** Whether the reader may attach files, which go to the draft. */
  canAttach?: boolean;
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
  const folder = page.folder.at(-1);
  const inFolder = folder && page.siblings.length > 1 ? folder : null;
  const closeContents = () => setContentsOpen(false);
  const commenting = Boolean(comments);
  const writable = version.number === document.version;

  const contentsButton =
    hasContents || inFolder ? (
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
        aside={
          hasContents || inFolder ? (
            <>
              {inFolder ? (
                <FolderNav folder={inFolder} siblings={page.siblings} current={document.id} />
              ) : null}
              {hasContents ? <Contents headings={body.headings} /> : null}
            </>
          ) : null
        }
        margin={commenting ? <CommentsMargin /> : null}
      >
        {notice}
        <PageHeader title={document.title} summary={body.summary}>
          <div className="document-meta">
            {byline}
            <div className="page-tools">
              <ExportTools title={document.title} source={source} />
              {tools}
            </div>
          </div>
        </PageHeader>
        <FilesProvider
          documentId={document.id}
          version={filesAt ?? version.number}
          files={page.files}
        >
          <div className="document-text">
            <div ref={text}>
              <LinksProvider links={page.links}>
                <DocumentBody tree={body.tree} />
              </LinksProvider>
            </div>
            {commenting ? <CommentPins /> : null}
          </div>
          <FileList editable={canAttach} />
        </FilesProvider>
        {commenting ? <CommentsEnd /> : null}
        {inFolder ? <FolderPager siblings={page.siblings} current={document.id} /> : null}
      </Page>
      <Sheet open={contentsOpen} onClose={closeContents} label="Contents">
        {inFolder ? (
          <FolderNav
            folder={inFolder}
            siblings={page.siblings}
            current={document.id}
            onNavigate={closeContents}
          />
        ) : null}
        {hasContents ? <Contents headings={body.headings} onNavigate={closeContents} /> : null}
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
