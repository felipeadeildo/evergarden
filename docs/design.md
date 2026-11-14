# Design

evergarden is one Cloudflare Worker running TanStack Start. Document metadata lives in D1, document content in R2, and every revision is immutable, which makes most of the system simple: content is addressed by its hash, rendered output is cached forever, and comments point at text that never changes under them.

This page explains the decisions and the parts. What people and agents do with it is in [flows.md](flows.md).

## Decisions

| Decision          | Choice                                                                                          | Why                                                                                                     | Cost                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Source of truth   | evergarden itself. Each `publish` creates an immutable revision                                 | Matches how documents are produced today (an agent writes, then uploads), with no git in the loop       | No sync with repositories; an export can come later                         |
| Who comments      | The owner, plus guests who sign in through a share link                                         | Reviews from other people are part of the use                                                           | Our own auth, and a minimum of moderation (delete a comment, revoke a link) |
| Rich content      | Markdown with directives (`::graph-*`) and a ` ```mockup ` block rendered in a sandboxed iframe | The source stays readable anywhere; nothing runs in the app's origin                                    | One renderer per directive, written by us                                   |
| Framework         | TanStack Start on Workers                                                                       | Server rendering for shared links (fast first paint, link previews), typed server functions, one deploy | More moving parts than a static SPA                                         |
| Database          | D1 through Drizzle                                                                              | Better Auth reaches D1 through Kysely or Drizzle; Drizzle gives one schema for app and auth tables      | D1's 10 GB per database limit, far above expected use                       |
| Content storage   | R2, keyed by SHA-256                                                                            | Immutable revisions become cache keys that never invalidate                                             | One extra read beside D1                                                    |
| Auth              | Better Auth with GitHub, Google and API keys                                                    | Open source, runs on Workers, has plugins for API keys and for MCP OAuth                                | Two OAuth apps to configure per install                                     |
| Agent credentials | API key in a header                                                                             | The Better Auth MCP OAuth plugin needs an SSRF-safe CIMD transport that we would write for Workers      | Clients that only speak OAuth (Claude.ai, ChatGPT) wait for a later version |

## Concepts

| Term     | Meaning                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Document | A path such as `reports/aws-costs-2026-11.md`. Folders are path prefixes, not records                                                      |
| Revision | One immutable version of a document, numbered from 1, with a message and an author (an agent's key or a person)                            |
| Thread   | A conversation attached to a passage of one revision. It may carry a suggestion: replacement text for the passage                          |
| Review   | A batch of new threads submitted together with a verdict: `approve`, `comment` or `request_changes`                                        |
| Share    | A link token for one document or one folder, either pinned to a revision or following the latest, granting read or read-and-comment access |

## Modules

The code is organised around four modules with small interfaces. Server functions (for the UI), `/api/v1` (for the CLI) and `/mcp` (for agents) are three thin adapters over the same modules, so a rule enforced once holds everywhere.

| Module               | Interface                                                                                           | Hides                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/render`         | `render(source) → { tree, title, headings }`, `RENDERER_VERSION`                                    | The unified pipeline, source positions, directive handling, sanitising                    |
| `src/anchor`         | `anchorFromRange(source, start, end)`, `relocate(anchor, before, after) → Anchor \| null`           | Prefix and suffix capture, diff mapping, fuzzy search                                     |
| `src/server/library` | `publish`, `read`, `list`, `history`, `diff`, `move`, `remove`                                      | Hashing, R2 writes, revision numbering, conflict checks, title extraction, render caching |
| `src/server/reviews` | `draftThread`, `submitReview`, `reply`, `resolve`, `applySuggestion`, `pendingReviews`, `getReview` | Draft visibility, re-anchoring after a publish, the agent-facing markdown format          |
| `src/server/access`  | `principalFrom(request)`, `authorize(principal, action, target)`                                    | Sessions, API keys, share tokens, guest membership, the owner rule                        |

`render` and `anchor` are pure and run in both the Worker and the browser, which is what keeps a selection in the browser and an anchor on the server in agreement.

## Rendering

The Worker renders markdown into a hast tree and stores it in R2 at `render/<sha>@<RENDERER_VERSION>.json`. A revision never changes, so the cache never needs invalidating; changing the renderer changes the key.

```
markdown
  → remark: gfm, frontmatter, directive, math
  → rehype: source positions, shiki (JavaScript regex engine, no WASM), katex, sanitize
  → hast-util-to-jsx-runtime: each directive becomes a React component
```

| Syntax                                                            | Renders as                                                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GFM: tables, task lists, footnotes, autolinks                     | The usual                                                                                                                         |
| `> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!CAUTION]`, `[!IMPORTANT]` | Callouts                                                                                                                          |
| `$x$`, `$$…$$`                                                    | KaTeX                                                                                                                             |
| ` ```mermaid `                                                    | A diagram; the mermaid bundle loads only on documents that use it                                                                 |
| ` ```mockup `                                                     | HTML in `<iframe sandbox="allow-scripts" srcdoc>` without `allow-same-origin`: a null origin with no access to cookies or the API |
| `::graph-timeline`, `::graph-decision`, and the rest              | Figures following the [mdxcn](https://mdxcn.dev/llms.txt) grammar, written as directives                                          |

mdxcn is used as a grammar, not as an MDX dependency: agents write markdown, never JSX, and the source reads fine on GitHub.

## Anchors

A thread points into the markdown source, not into the HTML.

1. The renderer adds each element's source offsets as `data-sourcepos`.
2. In the browser, a selection becomes a source range: the element's start offset plus the position of the selected text within it.
3. The thread stores, following the W3C Web Annotation model, `start`, `end`, the exact text (`exact`), and up to 32 characters before (`prefix`) and after (`suffix`).
4. When a new revision is published, each open thread is relocated: first by mapping its range through the diff between the two revisions, then by a fuzzy search for `prefix + exact + suffix`. With no match, the thread becomes `outdated` and stays attached to the revision where it was written.

## Data

D1, through Drizzle. Better Auth owns `user`, `session`, `account`, `verification` and `apikey`.

| Table          | Main columns                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document`     | `id`, `path` (unique), `title`, `head_revision`, `created_at`, `updated_at`, `deleted_at`                                                                                 |
| `revision`     | `id`, `document_id`, `number`, `sha256`, `message`, `author_kind` (`agent`, `user`), `author_id`, `created_at`                                                            |
| `review`       | `id`, `document_id`, `revision_id`, `author_id`, `verdict`, `body`, `submitted_at`, `consumed_at`                                                                         |
| `thread`       | `id`, `document_id`, `revision_id`, `review_id`, `anchor` (JSON), `status` (`open`, `resolved`, `outdated`), `suggestion`, `created_by`                                   |
| `comment`      | `id`, `thread_id`, `author_kind`, `author_id`, `body`, `created_at`, `edited_at`                                                                                          |
| `share`        | `id`, `token_hash`, `target_kind` (`document`, `folder`), `target`, `revision_id` (null follows the latest), `permission` (`read`, `comment`), `expires_at`, `revoked_at` |
| `share_member` | `share_id`, `user_id`, `joined_at`: a guest who signed in through a share                                                                                                 |
| `read_mark`    | `user_id`, `document_id`, `revision_number`, `read_at`: what "Waiting for you" compares against                                                                           |

A review with a null `submitted_at` is a draft, visible only to its author. `consumed_at` records when the agent read it, which is what `pending_reviews` filters on.

## Roles

| Role   | Signs in with                                      | Can                                                          |
| ------ | -------------------------------------------------- | ------------------------------------------------------------ |
| Owner  | The account whose email equals `OWNER_EMAIL`       | Everything                                                   |
| Agent  | An API key created by the owner                    | Publish, read, list, diff, reply, resolve, apply suggestions |
| Guest  | GitHub or Google, arriving through a comment share | Read the share's target, comment, submit reviews on it       |
| Reader | A share link, no sign-in                           | Read the share's target                                      |

`authorize` runs in every server function, API route and MCP tool that touches a document. Route guards only shape the UI.

## MCP

| Tool                                         | Does                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `publish(path, content, message, base_rev?)` | Creates a revision; returns its number and URL                                                                 |
| `read(path, rev?)`                           | Returns the markdown                                                                                           |
| `list(prefix?)`                              | Lists documents with their latest revision and open thread count                                               |
| `diff(path, from, to)`                       | Returns a unified diff of the markdown                                                                         |
| `move(path, new_path)`                       | Renames a document, keeping its history                                                                        |
| `pending_reviews()`                          | Submitted reviews the agent hasn't read                                                                        |
| `get_review(id)`                             | Returns the review as markdown (see [flows.md](flows.md#the-agent-works-through-the-review)) and marks it read |
| `reply(thread_id, body)`                     | Replies in a thread                                                                                            |
| `resolve(thread_id, body?)`                  | Resolves a thread, with an optional reply                                                                      |
| `apply_suggestion(thread_id)`                | Applies the suggestion as a new revision and resolves the thread                                               |

The CLI (`evergarden push`, `pull`, `ls`, aliased `eg`) calls `/api/v1` with the same rules.

## Security

- `rehype-sanitize` runs after every other plugin, so raw HTML in a document never reaches the page.
- Mockups run in an iframe with a null origin and a CSP that blocks the network, except the Tailwind CDN.
- Server functions use Start's CSRF middleware. `/api/v1` and `/mcp` accept only API keys, never cookies.
- Share tokens and API keys are stored as hashes.
- Responses that depend on a session send `Cache-Control: private, no-store`. Only a read share pinned to a revision is cached publicly.
- Better Auth reads the client IP from `cf-connecting-ip`, so rate limits apply per visitor.

## Open questions

- Whether the agent should be told about a new review (a webhook to pi) or keep asking `pending_reviews`.
- Whether PDF export uses [pdfcn](https://www.pdfcn.dev/llms.txt) or the browser's print with a print stylesheet.
