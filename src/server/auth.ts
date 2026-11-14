import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";

import { db } from "#/server/db";
import * as schema from "#/server/db/schema";

// The Better Auth CLI loads this file too (`bun run auth:schema`), with `cloudflare:workers` stubbed.
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || undefined,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
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
    apiKey({ defaultPrefix: "eg_", apiKeyHeaders: "x-api-key" }),
    // Must stay last.
    tanstackStartCookies(),
  ],
});

export function isOwner(email: string | null | undefined) {
  return Boolean(email) && email?.toLowerCase() === env.OWNER_EMAIL.toLowerCase();
}
