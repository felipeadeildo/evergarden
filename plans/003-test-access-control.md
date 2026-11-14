# Plan 003: Cover who may use the library with tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 710f7e4..HEAD -- src/server/access.ts src/server/auth.ts src/server/http.ts src/server/mcp.ts vitest.config.ts test/`
> If any of these changed, compare with "Current state" before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (tests only, plus test-only bindings)
- **Depends on**: none (pairs with plan 002, which runs these tests in CI)
- **Category**: tests
- **Planned at**: commit `710f7e4`, 2026-11-14

## Why this matters

evergarden is a private library: the owner and the owner's agents read and write, nobody else gets in. That rule lives in three small functions and has no test. The next roadmap step (share links for guests) rewrites exactly this code, and plan 004 tightens it. Characterization tests now make both changes safe and turn "is the library still private?" into a command.

## Current state

- `src/server/access.ts`:
  ```ts
  export type Principal =
    | { kind: "owner"; userId: string; name: string; email: string }
    | { kind: "agent"; keyId: string; name: string }
    | { kind: "guest"; userId: string; name: string; email: string };

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
    ...isOwner(user.email) ? owner : guest
  }

  export function authorize(principal: Principal | null): asserts principal is Principal {
    if (!principal) throw new EvergardenError("unauthorized", "Sign in, or send an API key, to use this library.");
    if (principal.kind === "guest") throw new EvergardenError("forbidden", "This library is private.");
  }
  ```
- `src/server/auth.ts`: Better Auth with `emailAndPassword: { enabled: import.meta.env?.DEV }`, a `databaseHooks.user.create.before` hook that throws `APIError("FORBIDDEN", ...)` unless `isOwner(user.email)`, and the `apiKey({ defaultPrefix: "eg_", ... })` plugin. `isOwner` compares with `env.OWNER_EMAIL`.
- `src/server/http.ts`: `handle(request, handler)` runs `principalFrom` and `authorize`, then returns JSON; `errorResponse` maps `EvergardenError` to `{ error: code, message }` with status 400/401/403/404/409.
- `src/server/mcp.ts`: `serveMcp(request, principal)` serves one stateless MCP request. `src/routes/mcp.ts` calls `principalFrom` + `authorize` before it.
- Test setup: `vitest.config.ts` project `workers` runs `src/server/**/*.test.ts` in workerd, `test/setup.ts` applies D1 migrations. Locally, wrangler also loads `.dev.vars`; CI has no `.dev.vars`, so `env.OWNER_EMAIL` and `env.BETTER_AUTH_SECRET` are undefined there.
- Pattern to follow: `src/server/library/library.test.ts` (imports `env` from `cloudflare:workers`, `describe/it/expect` from vitest, calls module functions directly).

## Commands you will need

| Purpose      | Command                                                       | Expected on success |
| ------------ | ------------------------------------------------------------- | ------------------- |
| Worker tests | `bunx vitest run --project workers`                           | all pass            |
| One file     | `bunx vitest run --project workers src/server/access.test.ts` | all pass            |
| Everything   | `bun run check`                                               | exit 0              |

## Scope

**In scope**:

- `vitest.config.ts` (test-only bindings)
- `src/server/access.test.ts` (create)

**Out of scope**:

- `src/server/access.ts`, `auth.ts`, `http.ts`, `mcp.ts`: this plan only describes current behaviour. If a test shows a bug, record it in the report; plan 004 changes `auth.ts`.

## Git workflow

- Branch: `advisor/003-access-tests`
- Commits: `test: set owner and auth secret for Worker tests`, then `test(access): cover owners, agents, guests and missing credentials`.

## Steps

### Step 1: Give the Worker tests a fixed owner and secret

In `vitest.config.ts`, extend the `miniflare.bindings` object of the `workers` project:

```ts
miniflare: {
  bindings: {
    TEST_MIGRATIONS: await readD1Migrations("migrations"),
    OWNER_EMAIL: "owner@example.com",
    BETTER_AUTH_SECRET: "test-secret-for-vitest-only-0123456789",
    BETTER_AUTH_URL: "http://localhost:3000",
  },
},
```

**Verify**: `bunx vitest run --project workers` → the existing library tests still pass.

### Step 2: Write `src/server/access.test.ts`

Use these helpers inside the file (adjust only if the Better Auth API differs; see STOP conditions):

```ts
import { describe, expect, it } from "vitest";

import { authorize, principalFrom } from "./access";
import { auth } from "./auth";
import { EvergardenError } from "./errors";
import { handle } from "./http";

const OWNER = "owner@example.com";

async function signUpOwner() {
  const response = await auth.api.signUpEmail({
    body: { email: OWNER, password: "correct-horse-battery", name: "Felipe" },
    asResponse: true,
  });
  const cookie = response.headers.get("set-cookie") ?? "";
  const { user } = (await response.json()) as { user: { id: string } };
  return { userId: user.id, cookie: cookie.split(";")[0]! };
}

async function createKey(userId: string, name = "pi") {
  const created = await auth.api.createApiKey({ body: { name, userId } });
  return created.key;
}
```

Write these cases (one `it` each):

1. **No credentials**: `principalFrom(new Headers())` resolves to `null`, and `authorize(null)` throws an `EvergardenError` with `code === "unauthorized"`.
2. **Owner session**: after `signUpOwner()`, `principalFrom(new Headers({ cookie }))` returns `{ kind: "owner", email: OWNER }` (use `toMatchObject`).
3. **Strangers cannot sign up**: `auth.api.signUpEmail({ body: { email: "stranger@example.com", password: "correct-horse-battery", name: "X" } })` rejects.
4. **Guests are refused**: `authorize({ kind: "guest", userId: "u", name: "G", email: "g@example.com" })` throws with `code === "forbidden"`.
5. **Agent key, both headers**: with a key from `createKey`, `principalFrom` returns `{ kind: "agent", name: "pi" }` for `authorization: Bearer <key>` and for `x-api-key: <key>`.
6. **Unknown key**: `principalFrom(new Headers({ authorization: "Bearer eg_not_a_key" }))` rejects with `code === "unauthorized"`.
7. **Revoked key**: create a key, delete its row (`import { db } from "./db"; import { apikey } from "./db/schema";` then `await db.delete(apikey)`), then `principalFrom` with it rejects with `code === "unauthorized"`.
8. **HTTP adapter**: `await handle(new Request("http://localhost/api/v1/documents"), async () => ({ ok: true }))` returns status `401` with JSON `{ error: "unauthorized" }`; the same with a valid key header returns `200` and `{ ok: true }`.

Tests share one D1 database per file. Sign up the owner once in a `beforeAll`, or make `signUpOwner` tolerate an existing account by signing in instead (`auth.api.signInEmail`, same body minus `name`).

**Verify**: `bunx vitest run --project workers src/server/access.test.ts` → 8 tests pass.

### Step 3: Run the whole check

**Verify**: `bun run check` → exit 0.

## Test plan

This plan is the test plan: 8 cases above in `src/server/access.test.ts`, modelled on `src/server/library/library.test.ts`.

## Done criteria

- [ ] `bunx vitest run --project workers src/server/access.test.ts` → 8 passed
- [ ] `bun run check` exits 0
- [ ] `git status` shows only `vitest.config.ts`, `src/server/access.test.ts` and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- `signUpEmail` fails with an error about cookies or request context (the `tanstackStartCookies()` plugin can expect a TanStack request). Try `asResponse: true` first, as written; if it still fails, stop and report the error.
- `auth.api.createApiKey` does not accept `userId` server-side in this Better Auth version: stop and report the signature from `node_modules/@better-auth/api-key/dist/*.d.mts`.
- A case fails because the current code behaves differently from the case (for example, a stranger _can_ sign up): do not change source code. Mark the case `it.fails` with a comment naming the behaviour, and report it.

## Maintenance notes

- Plan 004 adds a case here: an owner whose email is not verified is not the owner.
- Share links (roadmap step 3) will add `share` and `share_member` checks to `authorize`; extend this file first, then change `access.ts`.
