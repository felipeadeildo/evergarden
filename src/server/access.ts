import { eq } from "drizzle-orm";
import type { JWTPayload } from "jose";

import { agentForClient, agentForKey, touchAgent } from "#/server/agents";
import { auth, isOwner } from "#/server/auth";
import { db } from "#/server/db";
import { user } from "#/server/db/schema";
import { EvergardenError } from "#/server/errors";
import type { Author } from "#/server/library";

/** Who is making a request. Guests can sign in but have no access until share links exist. */
export type Principal =
  | { kind: "owner"; userId: string; name: string; email: string }
  | { kind: "agent"; agentId: string; name: string }
  | { kind: "guest"; userId: string; name: string; email: string };

export async function principalFrom(headers: Headers): Promise<Principal | null> {
  const key = apiKeyFrom(headers);
  if (key) {
    const result = await auth.api.verifyApiKey({ body: { key } });
    if (!result.valid || !result.key) {
      throw new EvergardenError("unauthorized", "The API key is invalid, expired or revoked.");
    }
    const found = await agentForKey(result.key.id, result.key.referenceId, result.key.name);
    await touchAgent(found.id);
    return { kind: "agent", agentId: found.id, name: found.name };
  }

  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const { user: viewer } = session;
  return isOwner(viewer.email)
    ? { kind: "owner", userId: viewer.id, name: viewer.name, email: viewer.email }
    : { kind: "guest", userId: viewer.id, name: viewer.name, email: viewer.email };
}

/** A valid token is not enough: the owner may have revoked the agent since it was issued. */
export async function principalFromToken(claims: JWTPayload): Promise<Principal> {
  const userId = claims.sub;
  const clientId = typeof claims.azp === "string" ? claims.azp : claims.client_id;
  if (!userId || typeof clientId !== "string") {
    throw new EvergardenError("unauthorized", "The access token names no user or client.");
  }
  const owner = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).get();
  if (!owner || !isOwner(owner.email)) {
    throw new EvergardenError("forbidden", "This library is private.");
  }
  const found = await agentForClient(userId, clientId);
  if (!found) {
    throw new EvergardenError("unauthorized", "This agent was disconnected. Sign in again.");
  }
  await touchAgent(found.id);
  return { kind: "agent", agentId: found.id, name: found.name };
}

export function authorize(principal: Principal | null): asserts principal is Principal {
  if (!principal) {
    throw new EvergardenError("unauthorized", "Sign in, or send an API key, to use this library.");
  }
  if (principal.kind === "guest") {
    throw new EvergardenError("forbidden", "This library is private.");
  }
}

export function authorOf(principal: Principal): Author {
  return principal.kind === "agent"
    ? { kind: "agent", id: principal.agentId, name: principal.name }
    : { kind: "user", id: principal.userId, name: principal.name };
}

export function apiKeyFrom(headers: Headers): string | null {
  const bearer = /^Bearer\s+(eg_\S+)$/i.exec(headers.get("authorization") ?? "")?.[1];
  return bearer ?? headers.get("x-api-key");
}
