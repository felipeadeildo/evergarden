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

/** An agent as the owner sees it in settings. */
export type AgentEntry = {
  id: string;
  name: string;
  /** How it connected: approved over OAuth, or holding an API key. */
  method: "oauth" | "key";
  /** The name the agent's software gave itself, such as "pi" or "Claude Code". */
  client: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

/** The agent signing a request: its row id and the name that signs what it writes. */
export type AgentIdentity = { id: string; name: string };

const MAX_NAME = 40;

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  if (!trimmed) throw new EvergardenError("invalid", "Give the agent a name.");
  return trimmed;
}

/** The OAuth client asking for access, for the /connect page: its own name and where it returns. */
export async function clientForConsent(clientId: string): Promise<{ name: string | null }> {
  const found = await db
    .select({ name: oauthClient.name })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
    .get();
  if (!found) throw new EvergardenError("not_found", "This agent is not registered.");
  return { name: found.name };
}

/** The name the owner already gave this OAuth client, if it connected before. */
export async function existingName(userId: string, clientId: string): Promise<string | null> {
  const found = await db
    .select({ name: agent.name })
    .from(agent)
    .where(and(eq(agent.userId, userId), eq(agent.clientId, clientId)))
    .get();
  return found?.name ?? null;
}

/** Records the name the owner chose on /connect, before the consent is sent. */
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

/** Creates an API key for an agent and returns its value; this is the only time it is readable. */
export async function createKeyAgent(userId: string, name: string): Promise<string> {
  const chosen = cleanName(name);
  const created = await auth.api.createApiKey({ body: { name: chosen, userId } });
  await db.insert(agent).values({ id: newId(), userId, apiKeyId: created.id, name: chosen });
  return created.key;
}

/** The agent behind an OAuth access token, or null when the owner revoked it. */
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

/** The agent holding an API key. A key without an agent row predates agents and gets one. */
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

/** Notes that an agent reached the library, at most once a minute. */
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
 * Locks an agent out at once. A key is deleted; an OAuth agent loses its consent and tokens, so
 * reconnecting asks the owner again. The agent row goes last, which is what /mcp checks.
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

/** The parts of a consent request the /connect page shows, after checking its signature. */
export type ConnectRequest = {
  clientId: string;
  /** What the agent's software calls itself, such as "pi". */
  clientName: string | null;
  /** Where the browser goes back to after approval. */
  returnsTo: string;
  /** The name to prefill: the one given before, or the software's own. */
  suggestedName: string;
};

/** Reads and verifies the signed query Better Auth put on the /connect URL. */
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
