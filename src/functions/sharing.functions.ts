import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { listGuests, listSharing, removeGuest, setSharing, sharedAs } from "#/server/sharing";

import { ownerAccess } from "./middleware";

const target = z.object({ kind: z.enum(["document", "folder"]), id: z.string() });

/** How a document or folder is shared: its own setting, or the one it inherits from a folder. */
export const getSharing = createServerFn({ method: "GET" })
  .middleware([ownerAccess])
  .validator(target)
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    return sharedAs(data);
  });

export const updateSharing = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(
    target.extend({
      permission: z.enum(["read", "comment"]).nullable(),
      expiresInDays: z.int().positive().max(365).nullable(),
    }),
  )
  .handler(({ data: { permission, expiresInDays, ...shared } }) =>
    setSharing(shared, permission, expiresInDays),
  );

export const getSharedList = createServerFn({ method: "GET" })
  .middleware([ownerAccess])
  .handler(async ({ context: { owner } }) => {
    setResponseHeader("cache-control", "private, no-store");
    const [items, people] = await Promise.all([listSharing(), listGuests(owner.userId)]);
    return { items, people };
  });

export const removePerson = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ id: z.string() }))
  .handler(({ data, context: { owner } }) => removeGuest(owner.userId, data.id));
