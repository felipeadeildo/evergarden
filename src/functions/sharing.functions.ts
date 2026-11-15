import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { listGuests, listSharing, removeGuest, setSharing, sharingOf } from "#/server/sharing";

import { ownerAccess } from "./middleware";

const target = z.object({ kind: z.enum(["document", "folder"]), id: z.string() });

/** How a document or folder is shared: its own setting and those it inherits from folders. */
export const getSharing = createServerFn({ method: "GET" })
  .middleware([ownerAccess])
  .validator(target)
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", "private, no-store");
    return sharingOf(data);
  });

/** Sets how a document or folder is shared; `settings: null` makes it private again. */
export const updateSharing = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(
    target.extend({
      settings: z
        .object({
          audience: z.enum(["link", "people"]),
          people: z.array(z.string().max(254)).max(200),
          permission: z.enum(["read", "comment"]),
          versions: z.enum(["current", "all"]),
          expiresInDays: z.int().positive().max(365).nullable(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ data: { settings, ...shared } }) => {
    await setSharing(shared, settings);
    return sharingOf(shared);
  });

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
