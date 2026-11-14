import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { DocumentBody } from "#/components/document/body";
import { Contents } from "#/components/document/contents";
import { VersionsMenu } from "#/components/document/versions-menu";
import { TopBar } from "#/components/navigation/top-bar";
import { ContentsIcon } from "#/components/ui/icons";
import { Sheet } from "#/components/ui/sheet";
import { getDocumentPage } from "#/functions/library.functions";

import katexCss from "katex/dist/katex.min.css?url";

export const Route = createFileRoute("/_authenticated/d/$id")({
  validateSearch: z.object({ v: z.int().positive().optional() }),
  loaderDeps: ({ search }) => ({ version: search.v }),
  loader: ({ params, deps }) => getDocumentPage({ data: { id: params.id, version: deps.version } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.document.title}, evergarden` : "evergarden" }],
    links: loaderData?.body.features.math ? [{ rel: "stylesheet", href: katexCss }] : [],
  }),
  component: DocumentPage,
});

function DocumentPage() {
  const { document, version, versions, body, folder } = Route.useLoaderData();
  const [contentsOpen, setContentsOpen] = useState(false);
  const isOld = version.number !== document.version;
  const hasContents = body.headings.length > 1;

  return (
    <>
      <TopBar
        actions={
          hasContents ? (
            <button
              type="button"
              className="quiet-button contents-toggle"
              onClick={() => setContentsOpen(true)}
            >
              <ContentsIcon />
              <span className="label">Contents</span>
            </button>
          ) : null
        }
      >
        {folder.length > 0 ? <span className="top-bar-folder">{folder.join("/")}</span> : null}
      </TopBar>
      <div className="reading">
        {hasContents ? (
          <aside className="reading-contents">
            <Contents headings={body.headings} />
          </aside>
        ) : null}
        <main id="main" className="reading-text">
          {isOld ? (
            <p className="old-version">
              You are reading version {version.number} of {document.version}.{" "}
              <Link to="/d/$id" params={{ id: document.id }}>
                Read the current version
              </Link>
            </p>
          ) : null}
          <header className="document-header">
            <h1>{document.title}</h1>
            <VersionsMenu documentId={document.id} versions={versions} shown={version.number} />
          </header>
          <DocumentBody tree={body.tree} />
        </main>
        <div className="reading-margin" aria-hidden="true" />
      </div>
      <Sheet open={contentsOpen} onClose={() => setContentsOpen(false)} label="Contents">
        <Contents headings={body.headings} onNavigate={() => setContentsOpen(false)} />
      </Sheet>
    </>
  );
}
