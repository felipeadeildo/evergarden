import { auth, isOwner } from "#/server/auth";
import { EvergardenError } from "#/server/errors";
import type { Author } from "#/server/library";

/** Who is making a request. Guests can sign in but have no access until share links exist. */
export type Principal =
  | { kind: "owner"; userId: string; name: string }
  | { kind: "agent"; keyId: string; name: string }
  | { kind: "guest"; userId: string; name: string };

/** An API key from `Authorization: Bearer` or `x-api-key`, otherwise the session cookie. */
export async function principalFrom(headers: Headers): Promise<Principal | null> {
  const key = apiKeyFrom(headers);
  if (key) {
    const result = await auth.api.verifyApiKey({ body: { key } });
    if (!result.valid || !result.key) {
      throw new EvergardenError("unauthorized", "The API key is invalid, expired or revoked.");
    }
    return { kind: "agent", keyId: result.key.id, name: result.key.name ?? "agent" };
  }

  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const { user } = session;
  return isOwner(user.email)
    ? { kind: "owner", userId: user.id, name: user.name }
    : { kind: "guest", userId: user.id, name: user.name };
}

/** Throws unless the principal may read and write the library. */
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
    ? { kind: "agent", id: principal.keyId, name: principal.name }
    : { kind: "user", id: principal.userId, name: principal.name };
}

function apiKeyFrom(headers: Headers): string | null {
  const bearer = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") ?? "")?.[1];
  return bearer ?? headers.get("x-api-key");
}
