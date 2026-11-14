import { apiKey } from "@better-auth/api-key";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { emailOTP, jwt } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";

import { db } from "#/server/db";
import * as schema from "#/server/db/schema";
import { sendSignInCode } from "#/server/email";

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
  databaseHooks: {
    user: {
      create: {
        // Only the owner has an account until share links let guests in.
        before: async (user) => {
          if (!isOwner(user.email)) {
            throw new APIError("FORBIDDEN", { message: "This library is private." });
          }
          return { data: user };
        },
      },
    },
  },
  advanced: {
    // Workers do not set X-Forwarded-For; without this every visitor shares one rate-limit bucket.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
  plugins: [
    emailOTP({
      expiresIn: 600,
      allowedAttempts: 5,
      storeOTP: "hashed",
      // Codes go only to the owner, so the form cannot be used to email strangers.
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === "sign-in" && isOwner(email)) sendSignInCode(email, otp);
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
