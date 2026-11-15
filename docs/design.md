# Design

evergarden is one Cloudflare Worker running TanStack Start, with everything in D1. Every version of a document is immutable, which keeps most of it simple: content is addressed by its hash, rendered output is cached for good, and a comment always knows the exact text it was written about.

What people and agents do with it is in [flows.md](flows.md).

## Decisions

| Decision          | Choice                                                                      | Why                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth   | evergarden itself; each `publish` or `update` creates an immutable version  | Agents write, then upload. No git in the loop                                                                                                                          |
| Addresses         | A random 10-character id (`k7q2mxa9pt`); folders live only in the library   | Links survive renames and moves, and reveal nothing about the title or folder                                                                                          |
| Review            | Comments posted one at a time, on text, blocks or points in diagrams        | How the owner reviews: read, mark, move on                                                                                                                             |
| Versions          | Kept and readable, each with the comments resolved on it; no diff view      | Comments need the text they were written about                                                                                                                         |
| Sharing           | A setting on the document or folder, at its usual address                   | One link per document, whoever opens it; access changes without new links                                                                                              |
| Markdown          | unified (remark and rehype)                                                 | Full GFM, source offsets on every node (comments need them), sanitising                                                                                                |
| Diagrams          | Mermaid syntax drawn by [Pele](https://pele.run)                            | Agents already write Mermaid. Pele is a sixth of Mermaid's size, takes its colours from CSS variables, and redraws wide diagrams vertically on phones                  |
| Code highlighting | [TanStack Highlight](https://tanstack.com/highlight)                        | Synchronous, about 80 languages, coloured from CSS. The first render of an example report took 457 ms with Shiki and 62 ms with TanStack Highlight and Pele            |
| Database          | D1 through Drizzle, SQLite FTS5 for search                                  | One schema for app and auth tables                                                                                                                                     |
| Content storage   | D1, keyed by SHA-256, with the rendered tree gzipped beside the text        | One database to deploy. Gzip brings a rendered tree back to about its markdown's size, under D1's 2 MB limit per value                                                 |
| Sign-in           | Better Auth: a six-digit code by email (Cloudflare Email Service)           | Nothing to register with GitHub or Google, and a code proves the inbox. Guests need Workers Paid to receive codes                                                      |
| Agent credentials | OAuth 2.1 through the Better Auth MCP plugin, API keys as a fallback        | MCP clients sign in with only the server address, and the owner names each agent while approving it on `/connect`. Clients register with RFC 7591 dynamic registration |
| Icons             | Phosphor, regular weight, named by meaning in `src/components/ui/icons.tsx` | Line icons that sit well beside Literata, swappable in one place                                                                                                       |

## Modules

Server functions (for the UI), `/api/v1` and `/mcp` (for agents) are thin adapters over the same modules, so a rule enforced once holds everywhere.

| Module                | Interface                                                                       | Hides                                                                              |
| --------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/render`          | `render(source) → { tree, title, headings, text, features }`                    | The unified pipeline, source offsets, sanitising, highlighting, diagrams, callouts |
| `src/anchor`          | `textRange`, `sourceRange`, `relocate(anchor, source)`                          | Prefix and suffix capture, block fingerprints, fuzzy search                        |
| `src/server/library`  | `publish`, `update`, `read`, `documentPage`, `list`, `folderContents`, `search` | Ids, hashing, stored text, version numbers, conflicts, titles, folders, the index  |
| `src/server/comments` | `addComment`, `addReply`, `resolve`, `acceptSuggestion`, `openComments`         | Re-anchoring after an update, what the agent has seen, the agent-facing format     |
| `src/server/access`   | `principalFrom(request)`, `authorize(principal)`                                | Sessions, API keys, OAuth tokens, the owner rule                                   |
| `src/server/sharing`  | `setSharing`, `sharingOf`, `accessFor(target, email)`, `guestAccess`            | Inheritance through folders, people lists, expiry, who may get a sign-in code      |

`render` and `anchor` are pure and run in both the Worker and the browser, which keeps a selection in the browser and an anchor on the server in agreement.

## Where the code lives

```
src/
  render/          markdown to a hast tree; pure
  anchor/          where a comment points, and how it follows edits; pure
  server/          runs only in the Worker: library, comments, sharing, access, auth, mcp, http
    db/            Drizzle schema; auth-schema.ts is generated by `bun run auth:schema`
  functions/       *.functions.ts: server functions for the UI
  routes/          one file per URL
    _authenticated the library and settings, owner only
    d.$id, f.$id   a document and a folder, for the owner and for guests
    api/, mcp.ts   server routes, no UI
  components/      document, comments, library, navigation, sharing, settings, ui
  lib/             helpers safe in the browser
```

- A route loads data and lays out a page. Anything reused or longer than a screen moves to `components/`.
- Code that touches D1 or secrets lives in `server/` and reaches the UI only through `functions/`.

## Rendering

The Worker renders markdown into a hast tree and stores it, gzipped, beside the text, with the `RENDERER_VERSION` that produced it. A version never changes, so the cache never needs invalidating; a newer renderer renders again on the next read.

```
markdown
  → remark: gfm, frontmatter, directives, math ($$x$$, and $x$ by the Pandoc rule)
  → rehype: raw HTML, sanitize
  → evergarden: callouts, figures, source offsets, heading ids, title, search text,
                links to documents, code highlighted by TanStack Highlight,
                mermaid drawn by Pele
  → katex
  → React, through hast-util-to-jsx-runtime
```

Sanitising runs before the evergarden step, so what that step adds is trusted output, not author input.

Directives (`:icon[x]`, `:::tabs`, `::timeline … ::`) are read by `remark-directive`. Any directive evergarden does not know goes back to the text it was written as, so "10:30" and "a:b" stay text. mdxcn closes a block with a `::` line, which markdown would read as part of a list right above it; before parsing, those lines are blanked with spaces, so every source offset still points into the stored text.

Reports are full of prices, so `$x$` follows the Pandoc rule: the opening `$` needs a non-space character after it, and the closing `$` a non-space character before it and no digit after it. In `$0.045 per GB … $950` both stay prices.

A diagram is drawn by the server, so it shows before any script runs, then again in the browser at the real column width, which turns a wide flowchart vertical on a phone. Full screen zooms by resizing the SVG, so text stays sharp.

## Anchors

A comment points into the markdown source of its version, not into the HTML. The renderer marks each block with its source offsets.

| Kind    | Made from                                   | Stores                                                               |
| ------- | ------------------------------------------- | -------------------------------------------------------------------- |
| `text`  | A selection, mapped to a source range       | `start`, `end`, the exact text, up to 32 characters before and after |
| `block` | The ☜ beside a table, code block or callout | The block's range and its first 200 characters as a fingerprint      |
| `point` | A click inside a diagram                    | The block's range and fingerprint, plus `x` and `y` from 0 to 1      |

The text anchor follows the W3C Web Annotation model (`exact`, `prefix`, `suffix`). When a version is saved, each open comment is searched for in the new text by its quote and context, or its fingerprint. A comment with no match becomes `detached` and keeps the version it was written on.

## Data

Better Auth owns `user`, `session`, `account`, `verification`, `apikey` and the OAuth tables. Every id is 10 random characters from `0-9a-z`.

| Table       | Main columns                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `content`   | `sha256`, `markdown`, the gzipped rendered tree, `renderer_version`                                                                          |
| `folder`    | `id`, `parent_id`, `name`, `position`, `repo` (unique when set)                                                                              |
| `document`  | `id`, `folder_id`, `position`, `title`, `summary`, `current_version`, `updated_at`, `deleted_at`, `deleted_from`                             |
| `version`   | `id`, `document_id`, `number`, `sha256`, `files` (name, hash, size, type), `author_kind`, `author_id`, `author_name`                         |
| `comment`   | `id`, `document_id`, `version_id`, `anchor` (JSON), `body`, `suggestion`, `status` (`open`, `resolved`, `detached`), author, `agent_seen_at` |
| `reply`     | `id`, `comment_id`, `body`, author, `edited_at`                                                                                              |
| `sharing`   | `target_kind`, `target_id`, `audience` (`link`, `people`), `people` (JSON), `permission`, `versions` (`current`, `all`), `expires_at`        |
| `draft`     | `document_id`, `base_version`, `markdown`, `files`, `edits`, author: the next version being edited                                           |
| `read_mark` | `user_id`, `document_id`, `version_number`: what the unread dot compares against                                                             |
| `agent`     | `id`, `name`, `client_id` or `api_key_id`, `last_used_at`                                                                                    |
| `search`    | FTS5 over the title and plain text of each document's current version                                                                        |

A comment's `version_id` follows it while it is open; once resolved it stays, which is how each version keeps its resolved comments.

## Speed

The slow part of a request is the distance to D1, which lives in one region. Each choice removes round trips.

- **Smart Placement** runs the Worker near D1, so a page's queries cost about a millisecond each.
- **One round trip per page.** Independent queries run together, and chained lookups, such as a folder path, are one recursive query.
- **Session cookie cache** (5 minutes): most requests check the session without the database.
- **TanStack Query** caches pages: hovering a link preloads it, and data older than 30 seconds refreshes in the background.
- **`waitUntil`** for writes that need not delay the answer, such as an agent's last-used time.

## Roles

| Role   | Signs in with                                             | Can                                                               |
| ------ | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Owner  | The account whose email equals `OWNER_EMAIL`              | Everything                                                        |
| Agent  | An OAuth client the owner approved, or a key              | Publish, edit, read, list, search, share, comment, reply, resolve |
| Guest  | An email code, on a page shared with them or for comments | Read what is shared with them, comment where it allows            |
| Reader | No sign-in                                                | Read what is shared by link                                       |

Access is checked on the server in every server function, API route and MCP tool. Route guards only shape the UI.

## MCP

| Tool                                       | Does                                                             |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `guide(topic?)`                            | The essentials of writing here, or one topic in detail           |
| `publish(content, title?, folder?, repo?)` | Creates a document; returns its id, version and URL              |
| `update(id, content, base_version?)`       | Saves a new version and moves open comments onto it              |
| `edit(id, edits)`                          | Replaces passages in the document's draft                        |
| `publish_draft(id)`, `discard_draft(id)`   | Saves the draft as the next version, or throws it away           |
| `attach(id, name, content_base64)`         | Puts a file in the draft; larger ones go by `PUT` to the API     |
| `detach(id, name)`                         | Takes a file out of the draft                                    |
| `share(id? \| folder?, who?, …)`           | Reads or sets who else can open a document or folder             |
| `move(id? \| folder?, to)`                 | Moves a document or folder; creates the target folders           |
| `rename(id? \| folder?, name)`             | Renames a folder, or retitles a document in a new version        |
| `read(id, version?, draft?)`               | Returns the markdown                                             |
| `list(folder?, repo?)`                     | Folders and documents, with open comment counts                  |
| `search(query)`                            | Full-text search; ids, titles and an excerpt                     |
| `open_comments(id?)`                       | Open comments as markdown, unseen first, and marks them seen     |
| `comment(id, passage, body)`               | Comments on a passage that appears once in the current version   |
| `reply(comment_id, body)`                  | Replies to a comment                                             |
| `resolve(comment_id, note?)`               | Resolves a comment, with an optional reply                       |
| `accept_suggestion(comment_id)`            | Applies the suggestion as a new version and resolves the comment |

The server's MCP instructions tell the agent to call `guide()` before its first `publish`.

## Security

- `rehype-sanitize` runs on the author's markdown, so raw HTML never reaches the page as written.
- `/mcp` accepts an OAuth access token bound to `<BETTER_AUTH_URL>/mcp`, or an API key, then loads the agent's row, so revoking an agent takes effect on its next request.
- API keys are stored as hashes. Pages are found by ids of ten random characters, about 51 bits.
- Responses that depend on a session send `Cache-Control: private, no-store`.
- Sign-in codes go only to the owner, to people listed on a shared page, and to guests of a page shared for comments.
- Better Auth reads the client IP from `cf-connecting-ip`, so rate limits apply per visitor.
- File bytes live in R2 once per hash. `/d/<id>/files/<name>` checks the same access as the document and its versions. Only PNG, JPEG, GIF, WebP and AVIF are served inline; everything else, SVG and HTML included, downloads, and every file carries `nosniff` and a sandboxing `Content-Security-Policy`, so nothing attached runs on the library's origin. A file's type comes from its name, never from the uploader.
