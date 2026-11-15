import { apiKey } from "@better-auth/api-key";
import { mcp } from "@better-auth/mcp";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
// The minimal build leaves out Kysely; the database is reached through the Drizzle adapter.
import { betterAuth } from "better-auth/minimal";
import { emailOTP, jwt } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env, waitUntil } from "cloudflare:workers";

import { SHARED_TARGET_HEADER } from "#/lib/shared";
import { db } from "#/server/db";
import * as schema from "#/server/db/schema";
import { sendSignInCode } from "#/server/email";
import { opensForComments } from "#/server/sharing";

/** This deployment's public URL. OAuth for agents needs a fixed one, so it is required outside dev. */
export const PUBLIC_URL = publicUrl(env.BETTER_AUTH_URL);

/** The MCP endpoint, and the resource every agent access token is bound to. */
export const MCP_RESOURCE = `${PUBLIC_URL}/mcp`;

// The Better Auth CLI loads this file too (`bun run auth:schema`), with `cloudflare:workers` stubbed.
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: PUBLIC_URL,
  // The JWT plugin's /token would hand the browser a session JWT signed like an access token.
  disabledPaths: ["/token"],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  // A signed cookie carries the session for 5 minutes, so most requests skip the session query.
  // A session revoked elsewhere stays usable here until then.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  databaseHooks: {
    user: {
      create: {
        // Accounts belong to the owner and to guests signing in on a page shared for comments.
        before: async (user, ctx) => {
          const shared = ctx?.headers?.get(SHARED_TARGET_HEADER);
          if (!isOwner(user.email) && !(await opensForComments(shared))) {
            throw new APIError("FORBIDDEN", { message: "This library is private." });
          }
          // A code sign-in creates the account with an empty name; settings can change this one.
          return { data: { ...user, name: user.name || user.email.split("@")[0] } };
        },
      },
    },
  },
  advanced: {
    // Workers do not set X-Forwarded-For; without this every visitor shares one rate-limit bucket.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    // Work that need not delay the response, such as cleanup, runs after it is sent.
    backgroundTasks: { handler: waitUntil },
  },
  plugins: [
    emailOTP({
      expiresIn: 600,
      allowedAttempts: 5,
      storeOTP: "hashed",
      // Codes go to the owner, and to guests on a page shared for comments (the page names itself
      // in a header). Anyone else gets no email, so the form cannot be used on strangers.
      sendVerificationOTP: async ({ email, otp, type }, ctx) => {
        if (type !== "sign-in") return;
        const shared = ctx?.headers?.get(SHARED_TARGET_HEADER);
        if (isOwner(email) || (await opensForComments(shared))) sendSignInCode(email, otp);
      },
    }),
    // Keys belong to the owner's agents, so the plugin's default limit of 10 requests a day is off.
    apiKey({ defaultPrefix: "eg_", apiKeyHeaders: "x-api-key", rateLimit: { enabled: false } }),
    jwt({ disableSettingJwtHeader: true }),
    // Clients register themselves (RFC 7591); only the owner's approval on /connect grants access.
    mcp({
      loginPage: "/sign-in",
      consentPage: "/connect",
      resource: MCP_RESOURCE,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
      scopes: ["openid", "profile", "offline_access"],
      clientRegistrationDefaultScopes: ["openid", "profile", "offline_access"],
      refreshTokenReuseInterval: 0,
    }),
    // Must stay last.
    tanstackStartCookies(),
  ],
});

export function isOwner(email: string | null | undefined) {
  return Boolean(email) && email?.toLowerCase() === env.OWNER_EMAIL.toLowerCase();
}

function publicUrl(configured: unknown): string {
  // The Better Auth CLI stubs `env`, so the value is not always a string.
  const url = typeof configured === "string" && configured ? configured : "http://localhost:3000";
  return url.replace(/\/$/, "");
}
