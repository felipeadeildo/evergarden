import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  CommentsEnd,
  CommentsProvider,
  CommentsSheet,
  SelectionBar,
  useComments,
} from "#/components/comments/comments";
import { CommentsMargin } from "#/components/comments/margin";
import { DocumentBody } from "#/components/document/body";
import { Contents } from "#/components/document/contents";
import { VersionsMenu } from "#/components/document/versions-menu";
import { FolderPath } from "#/components/navigation/folder-path";
import { TopBar } from "#/components/navigation/top-bar";
import { CommentIcon, ContentsIcon } from "#/components/ui/icons";
import { Page, PageHeader } from "#/components/ui/page";
import { Sheet } from "#/components/ui/sheet";
import { getDocumentPage, markDocumentRead } from "#/functions/library.functions";

import katexCss from "katex/dist/katex.min.css?url";

export const Route = createFileRoute("/_authenticated/d/$id")({
  validateSearch: z.object({ v: z.int().positive().optional(), c: z.string().optional() }),
  loaderDeps: ({ search }) => ({ version: search.v }),
  loader: ({ params, deps }) => getDocumentPage({ data: { id: params.id, version: deps.version } }),
  // Opening a comment only changes `?c=`; the document reloads when it is opened again.
  shouldReload: ({ cause }) => cause !== "stay",
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.document.title}, evergarden` : "evergarden" }],
    links: loaderData?.body.features.math ? [{ rel: "stylesheet", href: katexCss }] : [],
  }),
  component: DocumentPage,
});

function DocumentPage() {
  const { document, version, versions, body, folder, source } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [contentsOpen, setContentsOpen] = useState(false);
  const text = useRef<HTMLDivElement>(null);
  const isOld = version.number !== document.version;
  const hasContents = body.headings.length > 1;

  useEffect(() => {
    void markDocumentRead({ data: { id: document.id, version: version.number } });
  }, [document.id, version.number]);

  const setActive = useCallback(
    (id: string | null) =>
      void navigate({
        search: (prev) => ({ ...prev, c: id ?? undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  const page = (
    <>
      <TopBar
        actions={
          <>
            {isOld ? null : <CommentsButton />}
            {hasContents ? (
              <button
                type="button"
                className="quiet-button contents-toggle"
                onClick={() => setContentsOpen(true)}
              >
                <ContentsIcon />
                <span className="label">Contents</span>
              </button>
            ) : null}
          </>
        }
      >
        <FolderPath key={document.id} path={folder} documentId={document.id} />
      </TopBar>
      <Page
        aside={hasContents ? <Contents headings={body.headings} /> : null}
        margin={isOld ? null : <CommentsMargin />}
      >
        {isOld ? (
          <p className="old-version">
            You are reading version {version.number} of {document.version}.{" "}
            <Link to="/d/$id" params={{ id: document.id }}>
              Read the current version
            </Link>
          </p>
        ) : null}
        <PageHeader title={document.title}>
          <VersionsMenu documentId={document.id} versions={versions} shown={version.number} />
        </PageHeader>
        <div ref={text}>
          <DocumentBody tree={body.tree} />
        </div>
        {isOld ? null : <CommentsEnd />}
      </Page>
      <Sheet open={contentsOpen} onClose={() => setContentsOpen(false)} label="Contents">
        <Contents headings={body.headings} onNavigate={() => setContentsOpen(false)} />
      </Sheet>
      {isOld ? null : (
        <>
          <SelectionBar />
          <CommentsSheet />
        </>
      )}
    </>
  );

  // Comments anchor to the current version only; an older one is read without them.
  if (isOld) return page;
  return (
    <CommentsProvider
      key={version.number}
      documentId={document.id}
      version={version.number}
      source={source}
      root={text}
      active={search.c ?? null}
      setActive={setActive}
    >
      {page}
    </CommentsProvider>
  );
}

/** On a phone, where there is no margin, opens the first open comment. */
function CommentsButton() {
  const { open, setActive, wide } = useComments();
  if (wide || open.length === 0) return null;
  return (
    <button
      type="button"
      className="quiet-button"
      aria-label={`${open.length} open comments`}
      onClick={() => setActive(open[0]!.id)}
    >
      <CommentIcon />
      <span aria-hidden>{open.length}</span>
    </button>
  );
}
