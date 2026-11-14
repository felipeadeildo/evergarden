import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import { newId } from "#/lib/id";
import { auth } from "#/server/auth";
import { db } from "#/server/db";
import {
  agent,
  apikey,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
} from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";

export type AgentEntry = {
  id: string;
  name: string;
  method: "oauth" | "key";
  client: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

export type AgentIdentity = { id: string; name: string };

const MAX_NAME = 40;

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) throw new EvergardenError("invalid", "Give the agent a name.");
  return trimmed;
}

export async function clientForConsent(clientId: string): Promise<{ name: string | null }> {
  const found = await db
    .select({ name: oauthClient.name })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
    .get();
  if (!found) throw new EvergardenError("not_found", "This agent is not registered.");
  return { name: found.name };
}

export async function existingName(userId: string, clientId: string): Promise<string | null> {
  const found = await db
    .select({ name: agent.name })
    .from(agent)
    .where(and(eq(agent.userId, userId), eq(agent.clientId, clientId)))
    .get();
  return found?.name ?? null;
}

export async function nameOAuthAgent(
  userId: string,
  clientId: string,
  name: string,
): Promise<void> {
  const chosen = cleanName(name);
  await db
    .insert(agent)
    .values({ id: newId(), userId, clientId, name: chosen })
    .onConflictDoUpdate({ target: [agent.userId, agent.clientId], set: { name: chosen } });
}

/** The only time the key is readable. */
export async function createKeyAgent(userId: string, name: string): Promise<string> {
  const chosen = cleanName(name);
  const created = await auth.api.createApiKey({ body: { name: chosen, userId } });
  await db.insert(agent).values({ id: newId(), userId, apiKeyId: created.id, name: chosen });
  return created.key;
}

export async function agentForClient(
  userId: string,
  clientId: string,
): Promise<AgentIdentity | null> {
  const found = await db
    .select({ id: agent.id, name: agent.name })
    .from(agent)
    .where(and(eq(agent.userId, userId), eq(agent.clientId, clientId)))
    .get();
  return found ?? null;
}

/** A key created before agents existed gets its agent row here. */
export async function agentForKey(
  apiKeyId: string,
  userId: string,
  keyName: string | null,
): Promise<AgentIdentity> {
  const found = await db
    .select({ id: agent.id, name: agent.name })
    .from(agent)
    .where(eq(agent.apiKeyId, apiKeyId))
    .get();
  if (found) return found;
  const created = { id: newId(), name: keyName?.trim() || "agent" };
  await db
    .insert(agent)
    .values({ ...created, userId, apiKeyId })
    .onConflictDoNothing();
  return created;
}

export async function touchAgent(id: string): Promise<void> {
  const now = Date.now();
  await db
    .update(agent)
    .set({ lastUsedAt: new Date(now) })
    .where(
      and(
        eq(agent.id, id),
        or(isNull(agent.lastUsedAt), lt(agent.lastUsedAt, new Date(now - 60_000))),
      ),
    );
}

export async function listAgents(userId: string): Promise<AgentEntry[]> {
  const rows = await db
    .select({
      id: agent.id,
      name: agent.name,
      clientId: agent.clientId,
      client: oauthClient.name,
      createdAt: agent.createdAt,
      lastUsedAt: agent.lastUsedAt,
    })
    .from(agent)
    .leftJoin(oauthClient, eq(oauthClient.clientId, agent.clientId))
    .where(eq(agent.userId, userId))
    .orderBy(desc(agent.createdAt))
    .all();
  return rows.map(({ clientId, ...entry }) =>
    Object.assign(entry, { method: clientId ? ("oauth" as const) : ("key" as const) }),
  );
}

/**
 * Deleting the consent and tokens makes reconnecting ask the owner again. The agent row goes
 * last, because /mcp checks it on every request.
 */
export async function revokeAgent(userId: string, id: string): Promise<void> {
  const found = await db
    .select({ clientId: agent.clientId, apiKeyId: agent.apiKeyId })
    .from(agent)
    .where(and(eq(agent.id, id), eq(agent.userId, userId)))
    .get();
  if (!found) throw new EvergardenError("not_found", "No such agent.");

  const { clientId, apiKeyId } = found;
  const removeAgent = db.delete(agent).where(eq(agent.id, id));
  if (apiKeyId) {
    await db.batch([db.delete(apikey).where(eq(apikey.id, apiKeyId)), removeAgent]);
    return;
  }
  if (clientId) {
    await db.batch([
      db
        .delete(oauthConsent)
        .where(and(eq(oauthConsent.clientId, clientId), eq(oauthConsent.userId, userId))),
      db
        .delete(oauthAccessToken)
        .where(and(eq(oauthAccessToken.clientId, clientId), eq(oauthAccessToken.userId, userId))),
      db
        .delete(oauthRefreshToken)
        .where(and(eq(oauthRefreshToken.clientId, clientId), eq(oauthRefreshToken.userId, userId))),
      removeAgent,
    ]);
    return;
  }
  await removeAgent;
}

export type ConnectRequest = {
  clientId: string;
  clientName: string | null;
  returnsTo: string;
  suggestedName: string;
};

export async function connectRequest(userId: string, search: string): Promise<ConnectRequest> {
  const params = new URLSearchParams(search);
  const signed = new Set(["sig", "ba_param", ...params.getAll("ba_param")]);
  const query = new URLSearchParams([...params].filter(([key]) => signed.has(key)));
  const { secret } = await auth.$context;
  if (!(await verifyOAuthQueryParams(query.toString(), secret))) {
    throw new EvergardenError(
      "invalid",
      "This request expired. Start connecting from the agent again.",
    );
  }
  const clientId = query.get("client_id");
  const redirectUri = query.get("redirect_uri");
  if (!clientId || !redirectUri)
    throw new EvergardenError("invalid", "The request names no agent.");
  const { name: clientName } = await clientForConsent(clientId);
  const suggestedName = (await existingName(userId, clientId)) ?? clientName ?? "agent";
  return { clientId, clientName, returnsTo: new URL(redirectUri).host, suggestedName };
}
