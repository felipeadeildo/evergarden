import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { EvergardenError } from "#/server/errors";
import {
  folderContents,
  folderPath,
  markRead,
  newFor,
  read,
  rendered,
  search,
  versions,
  withPlaces,
} from "#/server/library";

import { libraryAccess } from "./middleware";

export const getLibrary = createServerFn({ method: "GET" })
  .middleware([libraryAccess])
  .handler(async ({ context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    const [root, unread] = await Promise.all([
      folderContents(null),
      principal.kind === "owner" ? newFor(principal.userId, 8).then(withPlaces) : [],
    ]);
    return { root, unread };
  });

/** One folder's contents, `id: null` for the top of the library, loaded when the folder opens. */
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
  .handler(async ({ data, context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    try {
      const page = await read(data.id, data.version);
      const [history, body, folder] = await Promise.all([
        versions(data.id),
        rendered(page.version.sha256),
        folderPath(page.document.folderId),
      ]);
      if (principal.kind === "owner") {
        await markRead(principal.userId, data.id, page.version.number);
      }
      return { document: page.document, version: page.version, versions: history, body, folder };
    } catch (error) {
      if (error instanceof EvergardenError && error.code === "not_found") throw notFound();
      throw error;
    }
  });

export const searchDocuments = createServerFn({ method: "GET" })
  .middleware([libraryAccess])
  .validator(z.object({ query: z.string().max(200) }))
  .handler(({ data }) => search(data.query, 12));
