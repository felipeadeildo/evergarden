import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { EvergardenError } from "#/server/errors";
import {
  folderContents,
  folderInfo,
  folderPath,
  markRead,
  read,
  recent,
  rendered,
  search,
  versions,
} from "#/server/library";

import { libraryAccess } from "./middleware";

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
  .middleware([libraryAccess])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    try {
      const [folder, contents] = await Promise.all([folderInfo(data.id), folderContents(data.id)]);
      return { folder, contents };
    } catch (error) {
      if (error instanceof EvergardenError && error.code === "not_found") throw notFound();
      throw error;
    }
  });

export const getFolder = createServerFn({ method: "GET" })
  .middleware([libraryAccess])
  .validator(z.object({ id: z.string().nullable(), offset: z.int().nonnegative() }))
  .handler(({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    return folderContents(data.id, data.offset);
  });

// The rendered tree is plain JSON, but hast's types allow arbitrary `data`, which the
// serialization type check rejects.
export const getDocumentPage = createServerFn({ method: "GET", strict: { output: false } })
  .middleware([libraryAccess])
  .validator(z.object({ id: z.string(), version: z.int().positive().optional() }))
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    try {
      const page = await read(data.id, data.version);
      const [history, body, folder] = await Promise.all([
        versions(data.id),
        rendered(page.version.sha256),
        folderPath(page.document.folderId),
      ]);
      return {
        document: page.document,
        version: page.version,
        versions: history,
        body,
        folder,
        source: page.source,
      };
    } catch (error) {
      if (error instanceof EvergardenError && error.code === "not_found") throw notFound();
      throw error;
    }
  });

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
