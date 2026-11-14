# Design

evergarden is one Cloudflare Worker running TanStack Start. Metadata lives in D1, document content in R2, and every version of a document is immutable, which keeps most of the system simple: content is addressed by its hash, rendered output is cached forever, and a comment always knows the exact text it was written about.

This page explains the decisions and the parts. What people and agents do with it is in [flows.md](flows.md).

## Decisions

| Decision          | Choice                                                                                          | Why                                                                                                     | Cost                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Source of truth   | evergarden itself. Each `publish` or `update` creates an immutable version                      | Matches how documents are produced today (an agent writes, then uploads), with no git in the loop       | No sync with repositories; an export can come later                         |
| Addresses         | A random 10-character id (`k7q2mxa9pt`); folders live only in the library                       | Links survive renames and moves, and a link reveals nothing about the title or the folder               | URLs say nothing about what they point to; link previews carry the title    |
| Review model      | Comments posted one at a time, as in Google Docs, on text, blocks or points in figures          | Matches how the owner reviews: read, mark, move on. The agent reads open comments when asked            | No batching: an agent that reads early sees a review in progress            |
| Versions          | Kept, listed quietly, readable; no diff view                                                    | Comments need the text they were written about; share links can pin a version                           | Storage for every version, small since content is deduplicated by hash      |
| Who comments      | The owner, plus guests who sign in through a share link                                         | Reviews from other people are part of the use                                                           | Our own auth, and a minimum of moderation (delete a comment, revoke a link) |
| Rich content      | Markdown with directives (`::graph-*`) and a ` ```mockup ` block rendered in a sandboxed iframe | The source stays readable anywhere; nothing runs in the app's origin                                    | One renderer per directive, written by us                                   |
| Framework         | TanStack Start on Workers                                                                       | Server rendering for shared links (fast first paint, link previews), typed server functions, one deploy | More moving parts than a static SPA                                         |
| Database          | D1 through Drizzle, with SQLite FTS5 for search                                                 | Better Auth reaches D1 through Kysely or Drizzle; Drizzle gives one schema for app and auth tables      | The FTS table is written by hand, outside Drizzle's schema                  |
| Content storage   | R2, keyed by SHA-256                                                                            | Immutable versions become cache keys that never invalidate                                              | One extra read beside D1                                                    |
| Auth              | Better Auth with GitHub, Google and API keys                                                    | Open source, runs on Workers, has plugins for API keys and for MCP OAuth                                | Two OAuth apps to configure per install                                     |
| Agent credentials | API key in a header                                                                             | The Better Auth MCP OAuth plugin needs an SSRF-safe CIMD transport that we would write for Workers      | Clients that only speak OAuth (Claude.ai, ChatGPT) wait for a later version |

## Concepts

| Term     | Meaning                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Document | Markdown with an id, a title, and a place in a folder. Its content changes only by creating a new version                               |
| Version  | One immutable content of a document, numbered from 1, with an author (an agent's key or a person)                                       |
| Folder   | A node in the library tree, with a manual order and an optional linked repository such as `github.com/ranqia/ada`                       |
| Comment  | A note attached to a passage, a block or a point in a figure of one version, with replies. It may carry a suggestion: replacement text  |
| Share    | A link token for one document or one folder, either pinned to a version or following the current one, granting read or read-and-comment |

## Modules

The code is organised around five modules with small interfaces. Server functions (for the UI), `/api/v1` (for the CLI) and `/mcp` (for agents) are thin adapters over the same modules, so a rule enforced once holds everywhere.

| Module                | Interface                                                                              | Hides                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/render`          | `render(source) → { tree, title, headings, blocks }`, `RENDERER_VERSION`               | The unified pipeline, source positions, directive handling, sanitising                         |
| `src/anchor`          | `anchorFrom(source, selection)`, `relocate(anchor, before, after) → Anchor \| null`    | Prefix and suffix capture, block fingerprints, diff mapping, fuzzy search                      |
| `src/server/library`  | `publish`, `update`, `read`, `list`, `search`, `versions`, `move`, `arrange`, `remove` | Ids, hashing, R2 writes, version numbering, conflict checks, titles, folders, the search index |
| `src/server/comments` | `comment`, `reply`, `resolve`, `acceptSuggestion`, `openComments`, `relocateAll`       | Re-anchoring after an update, what the agent has seen, the agent-facing markdown format        |
| `src/server/access`   | `principalFrom(request)`, `authorize(principal, action, target)`                       | Sessions, API keys, share tokens, guest membership, the owner rule                             |

`render` and `anchor` are pure and run in both the Worker and the browser, which is what keeps a selection in the browser and an anchor on the server in agreement.

## Rendering

The Worker renders markdown into a hast tree and stores it in R2 at `render/<sha>@<RENDERER_VERSION>.json`. A version never changes, so the cache never needs invalidating; changing the renderer changes the key.

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

A comment points into the markdown source of the version it was written on, not into the HTML. The renderer adds each block's source offsets as `data-sourcepos`, and every anchor starts from them.

| Kind    | Made from                                                      | Stores                                                                 |
| ------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `text`  | A browser selection, mapped to a source range inside its block | `start`, `end`, the exact text, up to 32 characters before and after   |
| `block` | The `+` beside a table, code block or callout                  | The block's source range and its first 200 characters as a fingerprint |
| `point` | A click inside an image, diagram or mockup                     | The block's range and fingerprint, plus `x` and `y` from 0 to 1        |

The text anchor follows the W3C Web Annotation model (`exact`, `prefix`, `suffix`). Points are stored relative to the figure's box, so they hold at any screen width. The pointer sits above a mockup's iframe only while placing a pin, since clicks inside a sandboxed frame never reach the page.

When a new version is saved, `relocateAll` moves every open comment: first by mapping its range through the diff between the two versions, then by a fuzzy search for the quote with its context (or the fingerprint, for blocks and points). A comment with no match becomes `detached`: it keeps the version it was written on and shows under "Comments on text that changed".

## Data

D1, through Drizzle. Better Auth owns `user`, `session`, `account`, `verification` and `apikey`. Every id is 10 random characters from `0-9a-z`, made with `crypto.getRandomValues`.

| Table          | Main columns                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `folder`       | `id`, `parent_id`, `name`, `position`, `repo` (unique when set)                                                                                                                  |
| `document`     | `id`, `folder_id`, `position`, `title`, `current_version`, `created_at`, `updated_at`, `deleted_at`                                                                              |
| `version`      | `id`, `document_id`, `number`, `sha256`, `author_kind` (`agent`, `user`), `author_id`, `created_at`                                                                              |
| `comment`      | `id`, `document_id`, `version_id`, `anchor` (JSON), `body`, `suggestion`, `status` (`open`, `resolved`, `detached`), `author_kind`, `author_id`, `agent_seen_at`                 |
| `reply`        | `id`, `comment_id`, `body`, `author_kind`, `author_id`, `created_at`, `edited_at`                                                                                                |
| `share`        | `id`, `token_hash`, `target_kind` (`document`, `folder`), `target_id`, `version_id` (null follows the current one), `permission` (`read`, `comment`), `expires_at`, `revoked_at` |
| `share_member` | `share_id`, `user_id`, `joined_at`: a guest who signed in through a share                                                                                                        |
| `read_mark`    | `user_id`, `document_id`, `version_number`, `read_at`: what "New for you" compares against                                                                                       |
| `search`       | An FTS5 table over the title and the plain text of each document's current version, written by `publish` and `update`                                                            |

`position` is a fractional index (a string that sorts between its neighbours), so moving one item rewrites one row. `agent_seen_at` on a comment, or on its newest reply, is what puts unseen comments first in `open_comments()`.

## Roles

| Role   | Signs in with                                      | Can                                                                           |
| ------ | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Owner  | The account whose email equals `OWNER_EMAIL`       | Everything                                                                    |
| Agent  | An API key created by the owner                    | Publish, update, read, list, search, move, reply, resolve, accept suggestions |
| Guest  | GitHub or Google, arriving through a comment share | Read the share's target, comment, suggest and reply on it                     |
| Reader | A share link, no sign-in                           | Read the share's target                                                       |

`authorize` runs in every server function, API route and MCP tool that touches a document. Route guards only shape the UI.

## MCP

| Tool                                       | Does                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `guide()`                                  | Returns the syntax evergarden renders and the owner's authoring guide                                                        |
| `publish(content, title?, folder?, repo?)` | Creates a document; returns its id, version and URL. `folder` is a path of names, created when missing                       |
| `update(id, content, base_version?)`       | Saves a new version and relocates open comments                                                                              |
| `read(id, version?)`                       | Returns the markdown                                                                                                         |
| `list(folder?, repo?)`                     | Lists folders and documents, with each document's open comment count                                                         |
| `search(query)`                            | Full-text search over titles and content; returns ids, titles and a matching excerpt                                         |
| `move(id, folder)`                         | Moves a document to another folder                                                                                           |
| `open_comments(id?)`                       | Open comments as markdown (see [flows.md](flows.md#the-agent-works-through-the-comments)), unseen first, and marks them seen |
| `reply(comment_id, body)`                  | Replies to a comment                                                                                                         |
| `resolve(comment_id, note?)`               | Resolves a comment, with an optional reply                                                                                   |
| `accept_suggestion(comment_id)`            | Applies the suggestion as a new version and resolves the comment                                                             |

The server's MCP `instructions` tell the agent to call `guide()` before its first `publish`. The authoring guide is an ordinary document that the owner picks in settings, so it has versions and takes comments like any other. The same text is exposed as the resource `evergarden://guide`.

The CLI (`evergarden push`, `pull`, `ls`, aliased `eg`) calls `/api/v1` with the same rules.

## Security

- `rehype-sanitize` runs after every other plugin, so raw HTML in a document never reaches the page.
- Mockups run in an iframe with a null origin and a CSP that blocks the network, except the Tailwind CDN.
- Server functions use Start's CSRF middleware. `/api/v1` and `/mcp` accept only API keys, never cookies.
- Share tokens and API keys are stored as hashes.
- Responses that depend on a session send `Cache-Control: private, no-store`. Only a read share pinned to a version is cached publicly.
- Better Auth reads the client IP from `cf-connecting-ip`, so rate limits apply per visitor.

## Open questions

- Whether the agent should be told about new comments (a webhook to pi) or keep asking `open_comments`.
- Whether PDF export uses [pdfcn](https://www.pdfcn.dev/llms.txt) or the browser's print with a print stylesheet.
