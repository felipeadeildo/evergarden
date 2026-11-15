import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { EntryCard, OrderedDocuments, OrderSelect } from "#/components/library/ordering";
import { OrganizeTools } from "#/components/library/organize";
import { DocumentRow, FolderRow, LoadMore, RepositoryLink } from "#/components/library/rows";
import { type FolderView, useFolder } from "#/components/library/use-folder";
import { FolderPath } from "#/components/navigation/folder-path";
import { Private } from "#/components/navigation/private";
import { SearchProvider } from "#/components/navigation/search";
import { TopBar } from "#/components/navigation/top-bar";
import { GuestActions } from "#/components/sharing/guest-actions";
import { ShareButton } from "#/components/sharing/share-dialog";
import { SharedPath } from "#/components/sharing/shared-path";
import { Page, PageHeader } from "#/components/ui/page";
import type { getFolderPage } from "#/functions/library.functions";
import { folderPageQuery } from "#/functions/queries";
import { plural } from "#/lib/text";

/** A folder, at the same address for everyone: the owner's, or one shared with the reader. */
export const Route = createFileRoute("/f/$id")({
  loader: async ({ params, location, context: { queryClient, viewer } }) => {
    const page = await queryClient.ensureQueryData(folderPageQuery(params.id));
    if (page.state === "private" && !viewer) {
      throw redirect({
        to: "/sign-in",
        search: { next: location.href, shared: `folder:${params.id}` },
      });
    }
    return page.state === "open" ? { name: page.folder.name } : null;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name}, evergarden` : "evergarden" }],
  }),
  component: FolderPage,
});

function FolderPage() {
  const { id } = Route.useParams();
  const { viewer } = Route.useRouteContext();
  const page = useSuspenseQuery(folderPageQuery(id)).data;
  if (page.state === "private")
    return (
      <Private
        email={viewer?.email ?? ""}
        retry={`/sign-in?${new URLSearchParams({ next: `/f/${id}`, shared: `folder:${id}` })}`}
      />
    );
  const owner = viewer?.kind === "owner";
  const content = (
    <FolderContent
      folder={page.folder}
      contents={page.contents}
      sharing={page.sharing}
      owner={owner}
    />
  );
  return owner ? <SearchProvider>{content}</SearchProvider> : content;
}

type FolderPageData = Extract<Awaited<ReturnType<typeof getFolderPage>>, { state: "open" }>;

function FolderContent({
  folder,
  contents,
  sharing,
  owner,
}: {
  folder: FolderPageData["folder"];
  contents: FolderPageData["contents"];
  sharing: FolderPageData["sharing"];
  owner: boolean;
}) {
  const { viewer } = Route.useRouteContext();
  const listing = useFolder(folder.id, contents);
  return (
    <>
      {owner ? (
        <TopBar
          actions={
            <ShareButton
              key={folder.id}
              subject={{ kind: "folder", id: folder.id }}
              sharing={sharing}
            />
          }
        >
          <FolderPath key={folder.id} path={folder.path} />
        </TopBar>
      ) : (
        <TopBar
          shared={{ home: `/f/${folder.path[0]?.id ?? folder.id}` }}
          actions={
            <GuestActions
              viewer={viewer}
              canComment={false}
              path={`/f/${folder.id}`}
              shared={`folder:${folder.id}`}
            />
          }
        >
          <SharedPath path={folder.path} />
        </TopBar>
      )}
      <Page>
        <PageHeader title={folder.name}>
          <div className="document-meta">
            <p className="page-details">
              {plural(folder.documents, "document")}
              {folder.repo ? <RepositoryLink repo={folder.repo} /> : null}
            </p>
            {owner ? (
              <div className="page-tools">
                <OrderSelect folderId={folder.id} sort={folder.sort} />
                <OrganizeTools
                  key={folder.id}
                  subject={{ kind: "folder", id: folder.id }}
                  name={folder.name}
                  // The path ends with the folder itself.
                  parentId={folder.path.at(-2)?.id ?? null}
                />
              </div>
            ) : null}
          </div>
        </PageHeader>
        <FolderListing listing={listing} folder={folder} owner={owner} />
      </Page>
    </>
  );
}

function FolderListing({
  listing,
  folder,
  owner,
}: {
  listing: FolderView;
  folder: FolderPageData["folder"];
  owner: boolean;
}) {
  if (listing.state !== "ready") return null;
  if (listing.folders.length + listing.documents.length === 0) {
    return (
      <p className="page-note">
        Nothing here yet. An agent files a document here by publishing it with the folder{" "}
        <code>{folder.path.map((step) => step.name).join("/")}</code>.
      </p>
    );
  }
  const entry = listing.documents.find((document) => document.id === folder.entryId);
  const documents = listing.documents.filter((document) => document !== entry);
  return (
    <>
      {entry ? <EntryCard entry={entry} folderId={owner ? folder.id : undefined} /> : null}
      {listing.folders.length > 0 ? (
        <ul className="rows">
          {listing.folders.map((child) => (
            <FolderRow key={child.id} entry={child} />
          ))}
        </ul>
      ) : null}
      {owner ? (
        <OrderedDocuments folderId={folder.id} documents={documents} entryId={folder.entryId} />
      ) : (
        <ul className="rows">
          {documents.map((document) => (
            <DocumentRow key={document.id} entry={document} />
          ))}
        </ul>
      )}
      {listing.more > 0 ? <LoadMore folder={listing} /> : null}
    </>
  );
}
