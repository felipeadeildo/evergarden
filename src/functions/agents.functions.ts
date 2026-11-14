import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  connectRequest,
  createKeyAgent,
  listAgents,
  nameOAuthAgent,
  revokeAgent,
} from "#/server/agents";

import { ownerAccess } from "./middleware";

export const getAgents = createServerFn({ method: "GET" })
  .middleware([ownerAccess])
  .handler(({ context: { owner } }) => {
    setResponseHeader("cache-control", "private, no-store");
    return listAgents(owner.userId);
  });

/** Returns the new key; the page shows it once. */
export const createAgentKey = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ name: z.string().max(80) }))
  .handler(({ data, context: { owner } }) => createKeyAgent(owner.userId, data.name));

export const revokeAgentAccess = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ id: z.string() }))
  .handler(({ data, context: { owner } }) => revokeAgent(owner.userId, data.id));

/** The agent asking to connect, read from the signed query on the /connect URL. */
export const getConnectRequest = createServerFn({ method: "GET" })
  .middleware([ownerAccess])
  .validator(z.object({ search: z.string().max(8000) }))
  .handler(({ data, context: { owner } }) => {
    setResponseHeader("cache-control", "private, no-store");
    return connectRequest(owner.userId, data.search);
  });

/** Saves the name the owner chose; the page then sends the consent itself. */
export const nameConnectingAgent = createServerFn({ method: "POST" })
  .middleware([ownerAccess])
  .validator(z.object({ search: z.string().max(8000), name: z.string().max(80) }))
  .handler(async ({ data, context: { owner } }) => {
    const request = await connectRequest(owner.userId, data.search);
    await nameOAuthAgent(owner.userId, request.clientId, data.name);
  });
