# Plan 001: Mark a document read when it is opened, not when its link is hovered

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 710f7e4..HEAD -- src/functions/library.functions.ts "src/routes/_authenticated/d.\$id.tsx" src/router.tsx`
> If any of these files changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `710f7e4`, 2026-11-14

## Why this matters

The library marks documents the owner has not read since they changed (a green dot and a bolder title under "Recently updated"). The read mark is written inside the server function that _loads_ the document page. The router preloads a route's loader when the pointer rests on a link, so resting the pointer on a document in the library marks it read without the owner opening it. The dot disappears for documents nobody read. After this plan, only rendering the document page writes the mark.

## Current state

- `src/router.tsx:13-14` turns on preloading on hover, and treats preloaded data as stale at once:
  ```ts
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  ```
- `src/functions/library.functions.ts`, `getDocumentPage` (a `GET` server function used as the document route's loader) writes the mark as a side effect:
  ```ts
  export const getDocumentPage = createServerFn({ method: "GET", strict: { output: false } })
    .middleware([libraryAccess])
    .validator(z.object({ id: z.string(), version: z.int().positive().optional() }))
    .handler(async ({ data, context: { principal } }) => {
      setResponseHeader("cache-control", "private, no-store");
      try {
        const page = await read(data.id, data.version);
        const [history, body, folder] = await Promise.all([ ... ]);
        if (principal.kind === "owner") {
          await markRead(principal.userId, data.id, page.version.number);
        }
        return { document: page.document, version: page.version, versions: history, body, folder };
      } catch (error) { ... }
    });
  ```
- `src/routes/_authenticated/d.$id.tsx` uses it as the loader: `loader: ({ params, deps }) => getDocumentPage({ data: { id: params.id, version: deps.version } })`. The page component is `function DocumentPage()`, which reads `const { document, version, versions, body, folder } = Route.useLoaderData();`.
- `markRead(userId, documentId, versionNumber)` in `src/server/library/index.ts` keeps the highest version ever read (`max(...)` on conflict), so calling it again, or for an older version, never lowers the mark.
- Conventions: server functions live in `src/functions/*.functions.ts`; every one that touches the library starts with `.middleware([libraryAccess])` and validates input with `.validator(z.object(...))`. Read-only ones use `{ method: "GET" }`; a function that writes uses `{ method: "POST" }` (the default).

## Commands you will need

| Purpose            | Command                       | Expected on success          |
| ------------------ | ----------------------------- | ---------------------------- |
| Install            | `bun install`                 | exit 0                       |
| Lint and typecheck | `bunx oxlint --deny-warnings` | no output, exit 0            |
| Everything         | `bun run check`               | exit 0, all tests pass       |
| Dev server         | `bun run dev`                 | serves http://localhost:3000 |

## Scope

**In scope**:

- `src/functions/library.functions.ts`
- `src/routes/_authenticated/d.$id.tsx`

**Out of scope**:

- `src/router.tsx`: keep hover preloading; it makes navigation instant. The bug is the side effect, not the preload.
- `src/server/library/index.ts`: `markRead` is correct as is.

## Git workflow

- Branch: `advisor/001-mark-read-on-open`
- Conventional Commits, subject line only, as in `git log`: e.g. `fix(ui): mark documents read when opened, not on hover`.
- Do not push unless the operator asks.

## Steps

### Step 1: Add a POST server function that marks a document read

In `src/functions/library.functions.ts`, add:

```ts
/** Records that the owner opened this version. Called by the document page once it renders. */
export const markDocumentRead = createServerFn({ method: "POST" })
  .middleware([libraryAccess])
  .validator(z.object({ id: z.string(), version: z.int().positive() }))
  .handler(async ({ data, context: { principal } }) => {
    if (principal.kind === "owner") await markRead(principal.userId, data.id, data.version);
  });
```

**Verify**: `bunx oxlint --deny-warnings` → no output.

### Step 2: Remove the side effect from the loader

In `getDocumentPage`, delete the `if (principal.kind === "owner") { await markRead(...) }` block. If `principal` is now unused in that handler, remove `context: { principal }` from its parameters.

**Verify**: `grep -n "markRead" src/functions/library.functions.ts` → exactly two lines: the import and the call inside `markDocumentRead`.

### Step 3: Call it from the page after it renders

In `src/routes/_authenticated/d.$id.tsx`, import `useEffect` from `react` and `markDocumentRead` from `#/functions/library.functions`. Inside `DocumentPage`, after the existing hooks:

```ts
useEffect(() => {
  void markDocumentRead({ data: { id: document.id, version: version.number } });
}, [document.id, version.number]);
```

**Verify**: `bun run check` → exit 0.

### Step 4: Confirm in a browser that hovering no longer marks read

1. `bun run dev` in one terminal.
2. Publish a fresh document with an API key (create one in `/settings`), or by signing in and using any existing document that shows the green unread dot on `/`.
3. On `/`, rest the pointer on that document's row for two seconds, then reload `/`. **Expected**: the dot is still there.
4. Click the row, then go back to `/` and reload. **Expected**: the dot is gone.

## Test plan

The bug lives in the wiring between the router and the server function, which the Worker test pool cannot drive. Step 4 is the regression check. `src/server/library/library.test.ts` already covers `markRead` and `recent(...).unread`; do not duplicate it.

## Done criteria

- [ ] `bun run check` exits 0
- [ ] `grep -n "markRead" src/functions/library.functions.ts` shows the call only inside `markDocumentRead`
- [ ] Step 4's two expected results hold
- [ ] `git status` shows changes only in the two in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `getDocumentPage` no longer contains the `markRead` call (someone fixed it differently): report and stop.
- Calling a POST server function from `useEffect` fails during server rendering (it should not run on the server; effects run only in the browser). If you see it run on the server, stop and report.

## Maintenance notes

- When share links arrive (guests reading documents), decide whether guests get read marks; `markDocumentRead` currently ignores everyone but the owner.
- Any future server function used as a route loader must stay free of writes for the same reason. A reviewer should reject writes inside `GET` server functions.
