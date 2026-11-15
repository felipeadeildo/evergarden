import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { authorOf } from "#/server/access";
import { db } from "#/server/db";
import { folder } from "#/server/db/schema";
import {
  deleteDocument,
  deleteFolder,
  destroyDocument,
  folderAt,
  moveDocument,
  moveFolder,
  renameDocument,
  renameFolder,
  restoreDocument,
  trash,
} from "#/server/library/organize";

import { ownerAccess } from "./middleware";

const target = z.object({ kind: z.enum(["document", "folder"]), id: z.string() });

export type FolderChoice = { id: string; parentId: string | null; name: string };

/** Every folder, for picking where something goes. */
export const getFolders = createServerFn({ method: "GET" })
  .middleware([ownerAccess])
  .handler(async (): Promise<FolderChoice[]> => {
    setResponseHeader("cache-control", "private, no-store");
    return db
      .select({ id: folder.id, parentId: folder.parentId, name: folder.name })
      .from(folder)
      .orderBy(asc(folder.position))
      .all();
  });

/** Moves into a folder by id (`null` is the top of the library), or into a new one by path. */
export const moveItem = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(
    target.extend({
      to: z.union([
        z.object({ id: z.string().nullable() }),
        z.object({ path: z.string().min(1).max(500) }),
      ]),
    }),
  )
  .handler(async ({ data }) => {
    const into = "path" in data.to ? await folderAt(data.to.path) : data.to.id;
    if (data.kind === "document") await moveDocument(data.id, into);
    else await moveFolder(data.id, into);
  });

export const renameItem = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(target.extend({ name: z.string().max(200) }))
  .handler(async ({ data, context: { owner } }) => {
    if (data.kind === "folder") await renameFolder(data.id, data.name);
    else await renameDocument(data.id, data.name, authorOf(owner));
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(target)
  .handler(({ data }) =>
    data.kind === "document" ? deleteDocument(data.id) : deleteFolder(data.id),
  );

export const getTrash = createServerFn({ method: "GET" })
  .middleware([ownerAccess])
  .handler(() => {
    setResponseHeader("cache-control", "private, no-store");
    return trash();
  });

export const restoreItem = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => restoreDocument(data.id));

export const destroyItem = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => destroyDocument(data.id));
