import { createFileRoute } from "@tanstack/react-router";

import { DocumentRow, FolderRow, RepositoryLink } from "#/components/library/rows";
import { type FolderView, useFolder } from "#/components/library/use-folder";
import { FolderPath } from "#/components/navigation/folder-path";
import { TopBar } from "#/components/navigation/top-bar";
import { Page, PageHeader } from "#/components/ui/page";
import { getFolderPage } from "#/functions/library.functions";

export const Route = createFileRoute("/_authenticated/f/$id")({
  loader: ({ params }) => getFolderPage({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.folder.name}, evergarden` : "evergarden" }],
  }),
  component: FolderPage,
});

function FolderPage() {
  const { folder, contents } = Route.useLoaderData();
  const listing = useFolder(folder.id, contents);

  return (
    <>
      <TopBar>
        <FolderPath key={folder.id} path={folder.path} />
      </TopBar>
      <Page>
        <PageHeader title={folder.name}>
          <p className="page-details">
            {folder.documents === 1 ? "1 document" : `${folder.documents} documents`}
            {folder.repo ? <RepositoryLink repo={folder.repo} /> : null}
          </p>
        </PageHeader>
        <FolderListing listing={listing} path={folder.path.map((step) => step.name).join("/")} />
      </Page>
    </>
  );
}

function FolderListing({ listing, path }: { listing: FolderView; path: string }) {
  if (listing.state !== "ready") return null;
  if (listing.folders.length + listing.documents.length === 0) {
    return (
      <p className="page-note">
        Nothing here yet. An agent files a document here by publishing it with the folder{" "}
        <code>{path}</code>.
      </p>
    );
  }
  return (
    <ul className="rows">
      {listing.folders.map((entry) => (
        <FolderRow key={entry.id} entry={entry} />
      ))}
      {listing.documents.map((entry) => (
        <DocumentRow key={entry.id} entry={entry} />
      ))}
      {listing.more > 0 ? (
        <li className="rows-more">
          <button
            type="button"
            className="link-button"
            disabled={listing.loadingMore}
            onClick={listing.loadMore}
          >
            {listing.loadingMore
              ? "Loading…"
              : `Show ${Math.min(listing.more, 50)} more of ${listing.more}`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
