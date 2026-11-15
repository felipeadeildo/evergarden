import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import type { Principal } from "#/server/access";
import { EvergardenError } from "#/server/errors";
import { documentPage, folderContents, folderInfo } from "#/server/library";
import {
  createShare,
  guestAccess,
  listGuests,
  listShares,
  openShare,
  revokeShare,
  shareCoversFolder,
} from "#/server/shares";

import { ownerAccess, sessionAccess } from "./middleware";

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(
    z.object({
      targetKind: z.enum(["document", "folder"]),
      targetId: z.string(),
      permission: z.enum(["read", "comment"]),
      pinned: z.boolean().optional(),
      expiresInDays: z.int().positive().max(365).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { token } = await createShare(data);
    return { url: new URL(`/s/${token}`, getRequestUrl()).href };
  });

export const getShareLinks = createServerFn({ method: "GET" })
  .middleware([ownerAccess])
  .handler(async () => {
    setResponseHeader("cache-control", "private, no-store");
    const [links, people] = await Promise.all([listShares(), listGuests()]);
    return { links, people };
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => revokeShare(data.id));

/** Who is looking at a share page, which shapes it: comments need a signed-in guest or the owner. */
function viewerOf(principal: Principal | null) {
  if (!principal || principal.kind === "agent") return null;
  return { kind: principal.kind, name: principal.name };
}

/** The page a share link opens: its document, or its folder's listing. */
export const getSharedPage = createServerFn({ method: "GET", strict: { output: false } })
  .middleware([sessionAccess])
  .validator(
    z.object({
      token: z.string().max(64),
      documentId: z.string().optional(),
      folderId: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    try {
      const found = await openShare(data.token, !data.documentId && !data.folderId);
      const link = {
        permission: found.permission,
        targetKind: found.targetKind,
        root: found.targetId,
      };
      const viewer = viewerOf(principal);
      const documentId =
        data.documentId ?? (found.targetKind === "document" ? found.targetId : undefined);
      if (documentId) {
        await guestAccess(principal, data.token, documentId, "read");
        const pinned =
          documentId === found.targetId ? (found.versionNumber ?? undefined) : undefined;
        return {
          link,
          viewer,
          kind: "document" as const,
          page: await documentPage(documentId, pinned),
        };
      }
      const folderId = data.folderId ?? found.targetId;
      if (!(await shareCoversFolder(found, folderId))) {
        throw new EvergardenError("not_found", "This link does not cover this folder.");
      }
      const [folder, contents] = await Promise.all([
        folderInfo(folderId),
        folderContents(folderId),
      ]);
      // The path above the shared folder belongs to the owner's library, not to the link.
      const from = folder.path.findIndex((step) => step.id === found.targetId);
      return {
        link,
        viewer,
        kind: "folder" as const,
        folder: { ...folder, path: folder.path.slice(Math.max(0, from)) },
        contents,
      };
    } catch (error) {
      if (error instanceof EvergardenError && error.code !== "unauthorized") throw notFound();
      throw error;
    }
  });
