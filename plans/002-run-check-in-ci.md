# Plan 002: Run `bun run check` on every push and pull request

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 710f7e4..HEAD -- package.json lefthook.yml vitest.config.ts .github`
> If any of these changed, compare with "Current state" before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `710f7e4`, 2026-11-14

## Why this matters

The repository is public (`github.com/felipeadeildo/evergarden`) and has no CI. The only gate is a local `pre-push` hook, which `git push --no-verify` skips and which never runs on someone else's pull request. A GitHub Actions workflow that runs the same `bun run check` makes every push and PR show whether formatting, lint, typecheck, the auth schema and the tests pass.

## Current state

- No `.github/` directory exists.
- `package.json` scripts (exact):
  ```json
  "check": "oxfmt --check && oxlint --deny-warnings && auth check schema --config src/server/auth.ts && vitest run --passWithNoTests",
  "prepare": "lefthook install"
  ```
  `oxlint` runs with type-aware rules, so it is also the typecheck.
- `package.json` pins `"packageManager": "bun@1.4.4"`; the lockfile is `bun.lock`.
- `lefthook.yml` has a `pre-push` job that runs `bun run check`.
- Tests: `vitest.config.ts` has two projects. `unit` runs in Node. `workers` runs `src/server/**/*.test.ts` inside workerd through `@cloudflare/vitest-plugin`, with local D1 and R2 from `wrangler.jsonc`. No Cloudflare account or secret is needed.
- Verified during planning: a fresh `git clone` with no `.dev.vars` file ran `bun install --frozen-lockfile` and `bun run check` successfully (4 test files, 46 tests).

## Commands you will need

| Purpose                             | Command                                             | Expected on success |
| ----------------------------------- | --------------------------------------------------- | ------------------- |
| Install                             | `bun install --frozen-lockfile`                     | exit 0              |
| Everything                          | `bun run check`                                     | exit 0              |
| Validate workflow syntax (optional) | `bunx action-validator .github/workflows/check.yml` | exit 0              |

## Scope

**In scope**:

- `.github/workflows/check.yml` (create)
- `README.md`: one status badge line, optional

**Out of scope**:

- Deploy automation. Deploys go through Cloudflare Workers Builds (see `docs/deploy.md`); adding `wrangler deploy` to Actions would need account secrets and duplicate that.
- Any change to `lefthook.yml` or the `check` script.

## Git workflow

- Branch: `advisor/002-ci`
- Commit: `ci: run bun run check on pushes and pull requests`
- Do not push unless the operator asks; the workflow only runs once pushed.

## Steps

### Step 1: Create the workflow

Create `.github/workflows/check.yml`:

```yaml
name: check

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: check-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      LEFTHOOK: "0" # the prepare script installs git hooks; CI needs none
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - run: bun install --frozen-lockfile
      - run: bun run check
```

**Verify**: `bunx oxfmt --check .github/workflows/check.yml` → exit 0 (run `bunx oxfmt .github/workflows/check.yml` first if it reports formatting).

### Step 2: Prove the commands pass on a clean checkout

```bash
rm -rf /tmp/eg-ci && git clone -q . /tmp/eg-ci && cd /tmp/eg-ci \
  && LEFTHOOK=0 bun install --frozen-lockfile && bun run check; echo "exit $?"
```

**Verify**: the last line is `exit 0`, and the output contains `Tests  N passed`.

### Step 3 (optional): Add a badge

Under the title in `README.md`:
`[![check](https://github.com/felipeadeildo/evergarden/actions/workflows/check.yml/badge.svg)](https://github.com/felipeadeildo/evergarden/actions/workflows/check.yml)`

**Verify**: `bunx oxfmt --check README.md` → exit 0.

## Test plan

No new tests. Step 2 runs the exact CI commands on a clean clone. After the operator pushes, the Actions tab must show the `check` run green.

## Done criteria

- [ ] `.github/workflows/check.yml` exists with the content of Step 1
- [ ] Step 2 prints `exit 0`
- [ ] `git status` shows only the in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 2 fails on the clean clone while `bun run check` passes in the working copy: something depends on an untracked file (likely `.dev.vars`). Report which test fails; do not add secrets to the workflow.
- `oven-sh/setup-bun@v2` does not accept `bun-version-file`: replace it with `bun-version: 1.4.4` and note it in the report.

## Maintenance notes

- Plan 003 adds Worker tests that need `OWNER_EMAIL` and `BETTER_AUTH_SECRET`; it sets them in `vitest.config.ts`, so this workflow needs no secrets. Keep it that way.
- If the test suite grows past a few minutes, split `unit` and `workers` into two jobs with `bunx vitest run --project unit` and `--project workers`.
