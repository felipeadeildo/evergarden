import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { render } from "#/render";
import { EvergardenError } from "#/server/errors";
import {
  documentPage,
  folderContents,
  folderInfo,
  markRead,
  recent,
  search,
} from "#/server/library";
import { type FolderStep, type LinkedDocument, linkedDocuments } from "#/server/library";
import { discardDraft, getDraft, publishDraft } from "#/server/library/drafts";
import { type Shared, guestAccess, sharingOf } from "#/server/sharing";

import { libraryAccess, ownerAccess, sessionAccess } from "./middleware";

/** A page someone may not open: they see a sign-in prompt, or that the library is private. */
const PRIVATE = { state: "private" as const };

/** Guests see only what was shared: the folder path starts at the shared folder. */
function sharedPath(path: FolderStep[], shared: Shared | null): FolderStep[] {
  if (!shared) return path;
  const from = path.findIndex((step) => step.id === shared.root);
  return from === -1 ? [] : path.slice(from);
}

/**
 * The linked documents this reader may open, and the ids of those they may not, which show as
 * plain text. Ids that are not in this library are links to somewhere else and stay links.
 */
async function linksFor(
  ids: string[],
  principal: Parameters<typeof guestAccess>[0],
): Promise<{ open: LinkedDocument[]; hidden: string[] }> {
  const found = await linkedDocuments(ids);
  if (principal && principal.kind !== "guest") return { open: found, hidden: [] };
  const open = await Promise.all(
    found.map((entry) =>
      guestAccess(principal, { kind: "document", id: entry.id }, "read").then(
        () => true,
        () => false,
      ),
    ),
  );
  return {
    open: found.filter((_, index) => open[index]),
    hidden: found.filter((_, index) => !open[index]).map((entry) => entry.id),
  };
}

function isPrivate(error: unknown): boolean {
  return (
    error instanceof EvergardenError &&
    (error.code === "forbidden" || error.code === "unauthorized")
  );
}

export const getLibrary = createServerFn({ method: "GET" })
  .middleware([libraryAccess])
  .handler(async ({ context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    const [latest, top] = await Promise.all([
      recent(principal.kind === "owner" ? principal.userId : null, 8),
      folderContents(null),
    ]);
    return { latest, top };
  });

export const getFolderPage = createServerFn({ method: "GET" })
  .middleware([sessionAccess])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    try {
      const target = { kind: "folder" as const, id: data.id };
      const shared = await guestAccess(principal, target, "read");
      const [folder, contents, sharing] = await Promise.all([
        folderInfo(data.id),
        folderContents(data.id),
        principal?.kind === "owner" ? sharingOf(target) : null,
      ]);
      return {
        state: "open" as const,
        folder: { ...folder, path: sharedPath(folder.path, shared) },
        contents,
        shared,
        sharing,
      };
    } catch (error) {
      if (isPrivate(error)) return PRIVATE;
      if (error instanceof EvergardenError && error.code === "not_found") throw notFound();
      throw error;
    }
  });

export const getFolder = createServerFn({ method: "GET" })
  .middleware([sessionAccess])
  .validator(z.object({ id: z.string().nullable(), offset: z.int().nonnegative() }))
  .handler(async ({ data, context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    if (data.id) await guestAccess(principal, { kind: "folder", id: data.id }, "read");
    else if (principal?.kind !== "owner" && principal?.kind !== "agent") {
      throw new EvergardenError("forbidden", "This library is private.");
    }
    return folderContents(data.id, data.offset);
  });

// The rendered tree is plain JSON, but hast's types allow arbitrary `data`, which the
// serialization type check rejects.
export const getDocumentPage = createServerFn({ method: "GET", strict: { output: false } })
  .middleware([sessionAccess])
  .validator(
    z.object({
      id: z.string(),
      version: z.union([z.int().positive(), z.literal("draft")]).optional(),
    }),
  )
  .handler(async ({ data, context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    try {
      const target = { kind: "document" as const, id: data.id };
      const shared = await guestAccess(principal, target, "read");
      const owner = principal?.kind === "owner";
      const showDraft = data.version === "draft";
      if (showDraft && !owner) throw notFound();
      const [page, sharing, draft] = await Promise.all([
        documentPage(data.id, typeof data.version === "number" ? data.version : undefined),
        owner ? sharingOf(target) : null,
        owner ? getDraft(data.id) : null,
      ]);
      if (showDraft) {
        if (!draft) throw notFound();
        Object.assign(page, {
          source: draft.markdown,
          files: draft.files,
          body: await render(draft.markdown),
        });
      }
      const links = await linksFor(page.body.links, principal);
      // A document shared at its current version only keeps its history from guests.
      const current = shared?.versions === "current";
      if (current && page.version.number !== page.document.version) throw notFound();
      return {
        state: "open" as const,
        ...page,
        versions: current ? page.versions.slice(0, 1) : page.versions,
        folder: sharedPath(page.folder, shared),
        // A guest sees the documents beside this one only when a folder above was shared.
        siblings: shared && !shared.root ? [] : page.siblings,
        shared,
        sharing,
        draft: draft && {
          baseVersion: draft.baseVersion,
          edits: draft.edits,
          authorName: draft.authorName,
          updatedAt: draft.updatedAt,
        },
        showsDraft: showDraft,
        links,
      };
    } catch (error) {
      if (isPrivate(error)) return PRIVATE;
      if (error instanceof EvergardenError && error.code === "not_found") throw notFound();
      throw error;
    }
  });

export const publishDocumentDraft = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => publishDraft(data.id));

export const discardDocumentDraft = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => discardDraft(data.id));

/** Called by the page once it renders: the loader also runs when a link is merely hovered. */
export const markDocumentRead = createServerFn({ method: "POST" })
  .middleware([libraryAccess])
  .validator(z.object({ id: z.string(), version: z.int().positive() }))
  .handler(async ({ data, context: { principal } }) => {
    if (principal.kind === "owner") await markRead(principal.userId, data.id, data.version);
  });

export const searchDocuments = createServerFn({ method: "GET" })
  .middleware([libraryAccess])
  .validator(z.object({ query: z.string().max(200) }))
  .handler(({ data }) => search(data.query, 12));
