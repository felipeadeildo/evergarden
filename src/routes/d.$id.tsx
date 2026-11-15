import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { z } from "zod";

import { DocumentView } from "#/components/document/document-view";
import { VersionsMenu } from "#/components/document/versions-menu";
import { OrganizeTools } from "#/components/library/organize";
import { FolderPath } from "#/components/navigation/folder-path";
import { Private } from "#/components/navigation/private";
import { SearchProvider } from "#/components/navigation/search";
import { GuestActions } from "#/components/sharing/guest-actions";
import { ShareButton } from "#/components/sharing/share-dialog";
import { SharedPath } from "#/components/sharing/shared-path";
import {
  discardDocumentDraft,
  markDocumentRead,
  publishDocumentDraft,
} from "#/functions/library.functions";
import { documentQuery, threadsQuery } from "#/functions/queries";

import katexCss from "katex/dist/katex.min.css?url";

/**
 * A document, at the same address for everyone. The owner reads it in the library; anyone else
 * reads it only when it, or a folder above it, is shared, and comments when it is shared for
 * comments and they signed in.
 */
export const Route = createFileRoute("/d/$id")({
  validateSearch: z.object({
    v: z.union([z.int().positive(), z.literal("draft")]).optional(),
    c: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ version: search.v }),
  loader: async ({ params, deps, location, context: { queryClient, viewer } }) => {
    const owner = viewer?.kind === "owner";
    const [page] = await Promise.all([
      queryClient.ensureQueryData(documentQuery(params.id, deps.version)),
      // The owner always sees comments, so they load alongside the page.
      owner ? queryClient.ensureQueryData(threadsQuery(params.id)) : null,
    ]);
    if (page.state === "private") {
      // Someone on a list of people signs in here to read; anyone else gets no code.
      if (!viewer) {
        throw redirect({
          to: "/sign-in",
          search: { next: location.href, shared: `document:${params.id}` },
        });
      }
      return null;
    }
    if (!owner && viewer && page.shared?.permission === "comment") {
      await queryClient.ensureQueryData(threadsQuery(params.id));
    }
    return {
      title: page.document.title,
      math: page.body.features.math,
      excerpt: page.body.summary ?? page.source.replace(/^#.*$/m, "").trim().slice(0, 180),
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title}, evergarden` },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.excerpt },
          { property: "og:image", content: "/og.png" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ title: "evergarden" }],
    links: loaderData?.math ? [{ rel: "stylesheet", href: katexCss }] : [],
  }),
  component: DocumentPage,
});

function DocumentPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { viewer } = Route.useRouteContext();
  const page = useSuspenseQuery(documentQuery(id, search.v)).data;
  const navigate = useNavigate({ from: Route.fullPath });

  const setActive = useCallback(
    (commentId: string | null) =>
      void navigate({
        search: (prev) => ({ ...prev, c: commentId ?? undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  if (page.state === "private")
    return (
      <Private
        email={viewer?.email ?? ""}
        retry={`/sign-in?${new URLSearchParams({ next: `/d/${id}`, shared: `document:${id}` })}`}
      />
    );
  const { document, version, versions, folder, shared, draft, showsDraft } = page;
  const isOld = version.number !== document.version;
  const byline = (
    <VersionsMenu
      documentId={document.id}
      versions={versions}
      shown={showsDraft ? "draft" : version.number}
      draft={draft}
    />
  );
  const notice =
    showsDraft && draft ? (
      <DraftNotice id={document.id} draft={draft} />
    ) : isOld ? (
      <p className="old-version">
        You are reading version {version.number} of {document.version}.{" "}
        <Link to="/d/$id" params={{ id: document.id }}>
          Read the current version
        </Link>
      </p>
    ) : null;

  if (viewer?.kind === "owner") {
    return (
      <SearchProvider>
        <MarkRead id={document.id} version={version.number} />
        <DocumentView
          page={page}
          place={<FolderPath key={document.id} path={folder} documentId={document.id} />}
          actions={
            isOld ? null : (
              <ShareButton
                key={document.id}
                subject={{ kind: "document", id: document.id }}
                sharing={page.sharing}
              />
            )
          }
          byline={byline}
          notice={notice}
          filesAt={showsDraft ? "draft" : version.number}
          canAttach={!isOld}
          tools={
            isOld || showsDraft ? null : (
              <OrganizeTools
                key={document.id}
                subject={{ kind: "document", id: document.id }}
                name={document.title}
                parentId={document.folderId}
              />
            )
          }
          comments={showsDraft ? null : { active: search.c ?? null, setActive, moderate: true }}
        />
      </SearchProvider>
    );
  }

  const commenting = shared?.permission === "comment";
  return (
    <DocumentView
      page={page}
      shared={{ home: shared?.root ? `/f/${shared.root}` : `/d/${id}` }}
      place={<SharedPath path={folder} />}
      actions={
        <GuestActions
          viewer={viewer}
          canComment={commenting}
          path={`/d/${id}`}
          shared={`document:${id}`}
        />
      }
      byline={byline}
      notice={notice}
      comments={
        commenting && viewer ? { active: search.c ?? null, setActive, moderate: false } : null
      }
    />
  );
}

/** Above a draft: what it is, and what the owner can do with it before the agent does. */
function DraftNotice({
  id,
  draft,
}: {
  id: string;
  draft: { baseVersion: number; edits: number; authorName: string };
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const done = useMutation({
    mutationFn: async (action: "publish" | "discard") => {
      const run = action === "publish" ? publishDocumentDraft : discardDocumentDraft;
      await run({ data: { id } });
    },
    onSuccess: async () => {
      // Refetching the draft now would fail, as it is gone: drop it and load the current version.
      queryClient.removeQueries({ queryKey: ["document", id] });
      await navigate({ to: "/d/$id", params: { id }, search: {} });
    },
  });
  const edits = `${draft.edits} edit${draft.edits === 1 ? "" : "s"}`;
  return (
    <div className="old-version draft-notice">
      <p>
        A draft by {draft.authorName}, {edits} on version {draft.baseVersion}. Readers do not see
        it.
      </p>
      <p className="draft-actions">
        <button
          type="button"
          className="button"
          disabled={done.isPending}
          onClick={() => done.mutate("publish")}
        >
          Publish
        </button>
        <button
          type="button"
          className="quiet-button"
          disabled={done.isPending}
          onClick={() => done.mutate("discard")}
        >
          Discard
        </button>
      </p>
      {done.error ? <p className="form-error">{done.error.message}</p> : null}
    </div>
  );
}

/** The owner has read this version once the page shows it; hovering a link loads it too early. */
function MarkRead({ id, version }: { id: string; version: number }) {
  useEffect(() => {
    void markDocumentRead({ data: { id, version } });
  }, [id, version]);
  return null;
}
