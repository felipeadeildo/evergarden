import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";

import { db } from "#/server/db";
import * as schema from "#/server/db/schema";

// The Better Auth CLI loads this file too (`bun run auth:schema`), with `cloudflare:workers` stubbed.
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || undefined,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  // Password sign-in exists only in `bun run dev`, where there is no OAuth app to sign in with.
  emailAndPassword: { enabled: import.meta.env?.DEV },
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
  socialProviders: {
    github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    ...(env.GOOGLE_CLIENT_ID && {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    }),
  },
  advanced: {
    // Workers do not set X-Forwarded-For; without this every visitor shares one rate-limit bucket.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
  },
  plugins: [
    // Keys belong to the owner's agents, so the plugin's default limit of 10 requests a day is off.
    apiKey({ defaultPrefix: "eg_", apiKeyHeaders: "x-api-key", rateLimit: { enabled: false } }),
    // Must stay last.
    tanstackStartCookies(),
  ],
});

export function isOwner(email: string | null | undefined) {
  return Boolean(email) && email?.toLowerCase() === env.OWNER_EMAIL.toLowerCase();
}
