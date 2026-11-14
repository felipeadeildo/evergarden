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
2. **The tree**: your folders and documents, in the order you arranged them.

Search (`⌘K`, or the search button on a phone) matches titles first, then the full text, and opens the document scrolled to the match.

## You read the report

`/d/k7q2mxa9pt` opens the current version. The page shows the title, one line saying who updated it and when, the text, and the notes in the margin. Nothing else.

| Area              | Desktop (≥1200 px)                             | Tablet (768 to 1199 px)                        | Phone                                     |
| ----------------- | ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Table of contents | Left column, current section marked            | Hidden; opens from the header                  | Hidden; opens from the header             |
| Text              | Centred column, about 66 characters per line   | Same                                           | Full width with side padding              |
| Comments          | Right margin, each note level with its passage | Markers in the margin; a note opens in a panel | Passage underlined; tapping opens a sheet |

Opening a document records which version you read, which is what empties "New for you".

## You comment on it

Commenting works like Google Docs: a comment is posted the moment you save it, and the agent can read it right away. What you can attach a comment to depends on what you are looking at.

| You point at                                          | How                                                        | The comment is attached to       |
| ----------------------------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| Text in a paragraph, list item, heading or table cell | Select it                                                  | That passage, which stays marked |
| A whole block: a table, a code block, a callout       | The `+` beside the block, in the margin                    | The block                        |
| A point in a figure: an image, a diagram, a mockup    | The comment button on the figure, then a click on the spot | A numbered pin at that spot      |

On the AWS report, three comments show all three kinds:

1. You select "Data transfer is the second biggest line item" and press **Comment** (or `⌘⌥M`). A note opens in the margin, level with the passage. You write "Is this NAT gateway traffic? Say so." and press **Comment** again. The passage stays marked in emerald.
2. You press `+` beside the cost table and write "Sort by cost, not by service name."
3. In the mermaid diagram, you click the arrow that points to EC2 and write "This should go to S3." A pin numbered 3 stays on the arrow.

On a phone, selecting text brings a bar to the bottom of the screen, clear of the system's copy and paste menu, with **Comment** and **Suggest**. The note opens in a sheet that covers half the screen, so the passage stays visible above it.

### Suggesting a rewrite

**Suggest** opens the same note with the selected text in the box. You edit it into the sentence you want, and the note shows the change word by word. The owner of the document sees **Accept** on the suggestion; accepting it creates a new version with that change and resolves the comment. The agent can accept it too (see below).

### Replies and resolving

Anyone who can comment can reply in a thread. **Resolve** closes it and takes it out of the margin; "3 resolved" at the end of the margin shows them again. `J` and `K` move to the next and previous comment, and `Esc` closes the open one.

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

### c_33 on a point in the figure "Traffic flow" (mermaid), open
Pin at 64% across, 38% down. Nearest label: "EC2".
- felipe: This should go to S3.
```

The agent then:

- calls `reply(comment_id, body)` to answer or push back;
- calls `accept_suggestion(comment_id)` for a suggestion it agrees with as written;
- rewrites what needs rewriting and calls `update(id, content)`, then `resolve(comment_id, note)` with one line on what changed.

## The agent updates the document

`update(id: "k7q2mxa9pt", content: "…")` saves version 2. Publishing the same content twice returns the existing version, so an agent that retries after a timeout does no harm. If someone else saved a version in between (for example, you accepted a suggestion), the agent can pass `base_version` and the call fails instead of overwriting; it then reads and tries again.

evergarden then looks for each open comment's passage in the new text, and finds it even when the paragraph moved. When the agent rewrote the passage beyond recognition, the comment moves to "Comments on text that changed" at the end of the document, quoting the old text, so you still see it.

## Older versions stay out of the way

The line under the title says "Updated 2 hours ago by pi". Its menu lists the versions; opening one shows it read-only, with a banner above the title that links back to the current version. There is no diff view. Versions exist so that comments keep their context and a share link can point at a fixed version.

## You share it

**Share** opens a dialog:

| Choice        | Options                                      | Default            |
| ------------- | -------------------------------------------- | ------------------ |
| What          | This document, or a folder (`ranqia/ada`)    | This document      |
| Which version | Always the current one, or this version only | Always the current |
| Access        | Read, or read and comment                    | Read               |
| Expires       | Never, 7 days, 30 days                       | Never              |

It creates a link like `https://docs.example.com/s/q9w3…`. The settings page lists every link, how often each was opened, and lets you revoke any of them.

## Someone opens your link

A colleague opens the link on their phone, from a chat app. The chat app's preview already showed the report's title and first sentence.

- **Read**: they see the document, with no sign-in, and no comments. A folder link shows that folder's tree and nothing else from your library.
- **Read and comment**: same, plus **Sign in to comment**. They sign in with GitHub or Google and land back on the same passage. From then on they comment, suggest and reply exactly as you do, and see every comment, yours included.

Their comments reach the agent like yours, with their name on each. Anyone who signs in without a link sees "This library is private" and nothing else.

## You manage access

`/settings` has four sections:

- **Agents**: API keys. Creating one shows the key once, with the MCP configuration to paste into pi. Each key has a name ("pi") that appears as the author of its versions and replies.
- **Links**: every share, with revoke.
- **People**: everyone who signed in through a link, the documents they commented on, and a button to remove their access.
- **Authoring guide**: the document that `guide()` hands to agents.

## What's left out on purpose

- **Diffs and review rounds.** Comments post one at a time, as in Google Docs; there is no draft review, verdict or comparison view.
- **Editing in the browser.** The agent writes; you comment and suggest. A full editor would compete with the agent for the same text.
- **Live collaboration.** New comments appear when you reload or come back to the tab, not while you watch.
- **Notifications.** The agent asks `open_comments`; you look at "New for you".
