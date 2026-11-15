# How evergarden is used

This page follows one document from the moment an agent writes it to the moment someone outside reads it, and names every screen and tool call on the way. The architecture behind these flows is in [design.md](design.md); the visual language is in [design-language.md](design-language.md).

The running example is a cost report. You ask your agent to look at last month's AWS bill and explain where the money went. It writes about 1,500 words titled "AWS costs, November", with two tables and a mermaid diagram of where the traffic goes.

## The agent publishes a document

Before its first document, the agent calls `guide()`. It returns what evergarden renders (callouts, mermaid, mockups, figures) and your authoring guide: how you want reports, plans and dossiers written. The guide is itself a document in evergarden, so you improve it by commenting on it.

Then the agent calls one MCP tool:

```
publish(content: "# AWS costs, November\n…", folder: "reports/2026")
→ { id: "k7q2mxa9pt", version: 1, url: "https://docs.example.com/d/k7q2mxa9pt" }
```

The document is now `k7q2mxa9pt`: ten random characters, lower-case letters and digits. That id is the document's only address. The URL, the MCP tools and share links all use it, so renaming the document or moving it to another folder never breaks a link.

The title comes from the frontmatter `title`, or else the first `#` heading. The agent gives you the URL.

## Folders are yours to arrange

A folder is a name in a tree (`reports/2026`, `ranqia/ada`), and it lives only in the library, never in a URL. `publish` creates the folders it names. In the library you rename folders, nest them, drag documents and folders into the order you want, and move a document to another folder; its URL stays the same.

A folder can be linked to a repository. Linking `ranqia/ada` to `github.com/ranqia/ada` lets an agent working inside that repository publish without knowing your folder names:

```
publish(content: "…", repo: "github.com/ranqia/ada")
```

The agent reads the repository from its git remote, and evergarden files the document in the linked folder. The same link answers `list(repo: "github.com/ranqia/ada")`: everything written about that repository. A folder is also what you share when a whole project should be visible to a colleague (see [You share it](#you-share-it)).

## You open the library

`/` is the library. It answers "what needs me?" before "where is everything?":

1. **New for you**: documents updated since you last opened them, and threads where the agent replied to you. A document you have never opened counts as new.
2. **The tree**: your folders and documents, in the order you arranged them. Folders start closed and load what they hold when you open one, so a library of thousands of documents opens as fast as an empty one. A folder with more than 50 documents shows them 50 at a time. The browser remembers which folders you left open.

Search (`⌘K`, or the search button on a phone) matches titles first, then the full text, and opens the document scrolled to the match.

## You read the report

`/d/k7q2mxa9pt` opens the current version. The page shows the title, one line saying who updated it and when, the text, and the notes in the margin. Nothing else. When the document has more than one version, that line opens the list of versions.

| Area              | Desktop (≥1200 px)                             | Tablet (768 to 1199 px)                        | Phone                                     |
| ----------------- | ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Table of contents | Left column, current section marked            | Hidden; opens from the header                  | Hidden; opens from the header             |
| Text              | Centred column, about 66 characters per line   | Same                                           | Full width with side padding              |
| Comments          | Right margin, each note level with its passage | Markers in the margin; a note opens in a panel | Passage underlined; tapping opens a sheet |

The top bar shows the folder the document sits in, such as `ranqia / plans`. Clicking it opens a menu of what `plans` holds; its back button climbs to `ranqia` and then to the top of the library, with the way back to the document marked, so you can open any other document without going back to the library. A phone shows only the last folder.

Diagrams take the width of the text, like everything else on the page; the right margin stays free for comments. A wide diagram drawn small opens full screen with a click, where you move around it by scrolling or dragging and zoom by pinching or holding ⌘ while scrolling.

Opening a document records which version you read, which is what empties "New for you".

## You comment on it

Commenting works like Google Docs: a comment is posted the moment you save it, and the agent can read it right away. What you can attach a comment to depends on what you are looking at.

| You point at                                          | How                                                                 | The comment is attached to                     |
| ----------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| Text in a paragraph, list item, heading or table cell | Select it                                                           | That passage, which stays marked               |
| A whole block: a table, a code block, a callout       | The ☜ that appears in the gutter beside the block under the pointer | The block, outlined while it has open comments |
| A point in a diagram                                  | The ☜ beside the diagram, then a click on the spot (Esc cancels)    | A numbered pin at that spot                    |

On the AWS report, three comments show all three kinds:

1. You select "Data transfer is the second biggest line item". A manicule appears in the gutter beside it; you click it (or press `⌘⌥M`). A note opens in the margin, level with the passage. You write "Is this NAT gateway traffic? Say so." and press **Comment** again. The passage stays marked in emerald.
2. You press `+` beside the cost table and write "Sort by cost, not by service name."
3. In the mermaid diagram, you click the arrow that points to EC2 and write "This should go to S3." A pin numbered 3 stays on the arrow.

On a phone, selecting text brings a bar to the bottom of the screen, clear of the system's copy and paste menu, with **Comment** and **Suggest**. The note opens in a sheet that covers half the screen, so the passage stays visible above it.

### Suggesting a rewrite

**Suggest** opens the same note with the selected text in the box. You edit it into the sentence you want, and the note shows the change word by word. The owner of the document sees **Accept** on the suggestion; accepting it creates a new version with that change and resolves the comment. The agent can accept it too (see below).

### Replies and resolving

Anyone who can comment can reply in a thread. **Resolve** closes it and takes it out of the margin. A resolved comment belongs to the version it was resolved on: the versions menu lists it under that version, and opening it there shows that version with the comment on its passage. `J` and `K` move to the next and previous comment, and `Esc` closes the open one.

## The agent works through the comments

When you tell the agent "look at my comments", it asks:

```
open_comments(id: "k7q2mxa9pt")
```

Without an id, `open_comments()` returns open comments across every document, with the ones the agent hasn't seen yet first. The answer is markdown the agent can act on without parsing anything:

```
## AWS costs, November (k7q2mxa9pt), version 1

### c_31 on text, open
> Data transfer is the second biggest line item.
Context: …EC2 was 41% of the bill, about $3,100. >>>Data transfer is the second biggest line item.<<< Most of it left through…
- felipe: Is this NAT gateway traffic? Say so.

### c_32 on the table "Cost by service", open
- felipe: Sort by cost, not by service name.

### c_33 on a point 62% across and 40% down a diagram, open
Pin at 64% across, 38% down. Nearest label: "EC2".
- felipe: This should go to S3.
```

The agent then:

- calls `reply(comment_id, body)` to answer or push back;
- calls `accept_suggestion(comment_id)` for a suggestion it agrees with as written;
- rewrites what needs rewriting and calls `update(id, content)`, then `resolve(comment_id, note)` with one line on what changed.

## The agent updates the document

`update(id: "k7q2mxa9pt", content: "…")` saves version 2. Publishing the same content twice returns the existing version, so an agent that retries after a timeout does no harm. If someone else saved a version in between (for example, you accepted a suggestion), the agent can pass `base_version` and the call fails instead of overwriting; it then reads and tries again.

evergarden then looks for each open comment's passage in the new text, and finds it even when the paragraph moved. When the agent rewrote the passage beyond recognition, the comment leaves the margin for "1 on changed text", above it, quoting the old text, so you still see it.

## Older versions stay out of the way

The line under the title says "Updated 2 hours ago by pi". Its menu lists the versions, each with the comments resolved on it; opening one shows it with those comments in the margin, and a banner above the title that links back to the current version. Nobody comments on an older version. There is no diff view. Versions exist so that comments keep their context.

## You share it

A document has one address, `https://evergarden.adeildo.dev/d/k7q2mxa9pt`, and so does a folder. Sharing changes who may open that address; it never makes a new one. **Share**, in the top bar of a document or folder, sets:

| Choice          | Options                                             | Default          |
| --------------- | --------------------------------------------------- | ---------------- |
| Who can open it | Only you; people I list; anyone with the link       | Only you         |
| They can        | Read; read and comment                              | Read             |
| Versions        | Only the current one; all versions (documents only) | Only the current |
| Stops working   | Never, in 7 days, in 30 days                        | Never            |

"People I list" takes emails and whole domains, `ana@acme.com` or `@acme.com`. No invitation is sent: they open the address, sign in with a code sent to their email, and read. Nobody else gets a code.

Each choice applies at once, and a sentence under the choices says what is in force: "ana@acme.com and @acme.com can read, the current version only." The Share button names it too ("Only you", "Link, read"), and lists in the library mark what is shared. Sharing a folder shares everything inside it, at any depth, including what agents publish there later. A document inside a shared folder says so, and its own setting can only open it further. Settings lists everything shared, with **Stop sharing** on each.

With "All versions", a guest opens older versions from the versions menu or with `?v=3`; with "Only the current one" they see neither the menu nor the comments resolved on older versions.

## Someone opens your link

A colleague opens the address on their phone, from a chat app. The chat app's preview already showed the report's title and first sentence.

- **Shared with people**: they sign in with an email code first, then read or comment as below.
- **Shared to read**: they read the document with no sign-in. The top bar has no search and no settings; its folder path starts at the shared folder, so nothing above it shows. Anything else in the library sends them to sign in, and then tells them the library is private.
- **Shared to comment**: the same, plus **Sign in to comment**. They get a code by email, come back to the page, and comment and reply exactly as you do, seeing every comment, yours included. Resolving and accepting suggestions stay with you and your agents.

Their comments reach the agent like yours, with their name on each. Codes go only to the owner, to the people listed on a shared page, and to people signing in from a page shared by link for comments; anyone else who tries gets no email.

## You manage access

Agents sign in over OAuth, the way MCP clients expect. You give pi only the address, `pi mcp add evergarden --url https://evergarden.adeildo.dev/mcp`. The first time it connects, `/mcp` answers 401 and points pi at evergarden's OAuth endpoints. pi registers itself and opens your browser. You sign in if you are not already, and land on `/connect`: "pi wants to read, publish and update the documents in your library", with a name field filled with "pi". You rename it if you like ("pi on laptop"), allow it, and the browser hands pi its tokens. From then on the agent signs what it writes with that name.

`/settings` shows the server address and, in one tab per agent CLI (pi, Claude Code, Codex, Gemini CLI), the command that adds it. For a client without OAuth, "Use an API key instead" creates a named key, shown once, with the same commands carrying the key.

Under it:

- **Connected agents**: every agent, however it connected, with how (signed in, or API key), when it last reached the library, and a revoke button that asks once. Revoking deletes the key, or the OAuth consent and tokens, and the agent's row, which `/mcp` checks on every request, so even an unexpired access token stops working at once.
- **Shared**: every document and folder you shared, how, until when, and **Stop sharing**.
- **People**: everyone who signed in to comment, with **Remove**, which signs them out; their comments stay.
- **Authoring guide**: the document that `guide()` hands to agents.

## What's left out on purpose

- **Diffs and review rounds.** Comments post one at a time, as in Google Docs; there is no draft review, verdict or comparison view.
- **Editing in the browser.** The agent writes; you comment and suggest. A full editor would compete with the agent for the same text.
- **Live collaboration.** New comments appear when you reload or come back to the tab, not while you watch.
- **Notifications.** The agent asks `open_comments`; you look at "New for you".
