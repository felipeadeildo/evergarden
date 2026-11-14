# How evergarden is used

This page follows one document from the moment an agent writes it to the moment someone outside reads it, and names every screen and tool call on the way. The architecture behind these flows is in [design.md](design.md); the visual language is in [design-language.md](design-language.md).

The running example is a cost report. You ask your agent to look at last month's AWS bill and explain where the money went. It writes `reports/aws-costs-2026-11.md`, about 1,500 words with two tables and a mermaid diagram.

## The agent publishes a document

The agent calls one MCP tool:

```
publish(path: "reports/aws-costs-2026-11.md", content: "# AWS costs, November\n…", message: "First draft")
→ { path, rev: 1, url: "https://docs.example.com/d/reports/aws-costs-2026-11.md" }
```

evergarden hashes the content, stores it in R2 under that hash, and records revision 1. The agent gives you the URL.

Three rules make publishing safe to repeat:

- Publishing the same content twice returns the existing revision instead of creating an empty one, so an agent that retries after a timeout does no harm.
- The agent may pass `base_rev`. If someone else created a revision after `base_rev` (for example, you applied a suggestion in the browser), the call fails with the current revision number, and the agent reads before writing again.
- The title comes from the frontmatter `title`, or else the first `#` heading, or else the file name.

Paths are folders. `reports/aws-costs-2026-11.md` creates nothing called `reports`; the folder exists because a document lives under it, and it disappears when the last one moves away.

## You open the library

`/` is the library. It answers "what needs me?" before "where is everything?", so it has two parts:

1. **Waiting for you**: documents with a revision you haven't read. Each row shows the path, the title, how many revisions are new since you last opened it, and who wrote them. A document you have never opened counts as new.
2. **All documents**: the folder tree, with the most recently changed folders first.

A third, quieter list shows reviews the agent hasn't picked up yet, so you can see when it's behind.

Quick open (`⌘K`, or the search button on mobile) filters documents by path and title. Full-text search comes later.

## You read the report

`/d/reports/aws-costs-2026-11.md` opens the latest revision. The page is a letter, not a dashboard: a title, a line with the path and revision, the text, and nothing else competing with it.

| Area              | Desktop (≥1200 px)                             | Tablet (768 to 1199 px)                             | Phone                                                                   |
| ----------------- | ---------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Table of contents | Left column, current section marked            | Hidden; opens from the header                       | A pill at the top showing the current section; tapping it opens a sheet |
| Text              | Centred column, about 66 characters per line   | Same                                                | Full width with side padding                                            |
| Comments          | Right margin, each note level with its passage | Markers in the margin; a note opens in a side panel | Passage underlined; tapping opens a bottom sheet                        |
| Revision          | `rev 3 of 3` in the header, opens the history  | Same                                                | Same, inside the header menu                                            |

Opening a document records that you read that revision, which is what empties "Waiting for you".

Older revisions open with `?rev=2`. The page says so above the title and links back to the latest one, because reading an old version by accident is the easiest mistake to make here.

## You review it

Reviewing works like a pull request review: comments pile up as a draft, and nothing reaches the agent until you submit.

1. You select "Data transfer is the second biggest line item" in the third paragraph.
2. A bar appears. On desktop it floats above the selection; on a phone it sits at the bottom of the screen, clear of the system's copy and paste menu. It offers **Comment** and **Suggest**.
3. **Comment** opens a note in the margin (a sheet on the phone). You write "Is this NAT gateway traffic? Say so." and save it. The passage stays highlighted, and the review bar at the bottom says `1 pending`.
4. **Suggest** opens the same note with the selected markdown already in the box. You edit it into the sentence you want. The note shows the change as a word diff before you save.
5. When you're done, the review bar's **Submit review** asks for a verdict and an optional summary:
   - **Request changes**: the agent should revise.
   - **Comment**: notes for the agent, no revision expected.
   - **Approve**: the document is done.

Replies to existing threads post right away; only new threads wait for the review. A pending review survives closing the tab, because it lives on the server.

If your selection crosses into a mermaid diagram or a mockup, the note attaches to the whole block, since the drawn text doesn't exist in the markdown.

## The agent works through the review

The agent asks what's waiting:

```
pending_reviews()
→ [{ id: "rv_8f2", path: "reports/aws-costs-2026-11.md", rev: 1, verdict: "request_changes", threads: 4 }]

get_review(id: "rv_8f2")
```

`get_review` returns markdown the agent can act on without parsing anything. For each thread:

```
### Thread th_31 (open)
Quote, lines 14-14:
> Data transfer is the second biggest line item.
Context:
  …EC2 was 41% of the bill, about $3,100.
  >>> Data transfer is the second biggest line item. <<<
  Most of it left through the NAT gateway in us-east-1…
Suggestion:
  Data transfer through the us-east-1 NAT gateway is the second biggest line item, at $1,240.
Comments:
  felipe: Is this NAT gateway traffic? Say so.
```

The same call marks the review as read, so it leaves `pending_reviews`.

Then the agent revises:

- `apply_suggestion(thread_id)` for a suggestion it accepts as written. It creates a revision with only that change and resolves the thread.
- `publish(path, content, message, base_rev)` for anything that needs rewriting, followed by `resolve(thread_id, body)` with a one-line note on what changed, or `reply(thread_id, body)` to push back.

## Comments follow the text

When revision 2 arrives, every open thread from revision 1 needs a new position. evergarden tries the diff between the revisions first, then searches for the quoted passage with its surrounding words. If neither finds it, the thread is marked **outdated**: it stays visible on revision 1, and revision 2 lists it at the bottom under "Comments on earlier revisions" so nothing disappears silently.

The full anchoring rules are in [design.md](design.md#anchors).

## You compare revisions

`/d/reports/aws-costs-2026-11.md?diff=1..2` shows what the agent changed. The default is the rendered document with changes marked inline: removed words struck through in the margin colour, added words underlined. Unchanged sections fold to one line each, and a toggle shows the raw markdown diff instead.

Threads resolved by that revision appear next to the change that resolved them, with the agent's note. That's how you check its work without rereading the whole report.

## You share it

**Share** in the header opens a dialog with four choices:

| Choice        | Options                                              | Default           |
| ------------- | ---------------------------------------------------- | ----------------- |
| What          | This document, or its folder (`reports/`)            | This document     |
| Which version | Always the latest, or pinned to the current revision | Always the latest |
| Access        | Read, or read and comment                            | Read              |
| Expires       | Never, 7 days, 30 days                               | Never             |

It creates a link like `https://docs.example.com/s/k3v9…`. The settings page lists every link you've made, how often each was opened, and lets you revoke any of them.

## Someone opens your link

A colleague opens the link on their phone, from a chat app. The chat app's preview already showed the report's title and first sentence.

- **Read**: they see the document, with no sign-in. They don't see comments, the revision history, or anything else in your library. A folder link shows a small tree of that folder only.
- **Read and comment**: same, plus a **Sign in to comment** button. They sign in with GitHub or Google and come back to the same place. From then on they can select text, comment, suggest and submit a review, exactly as you do. They see every thread on the document, including yours, because a review only makes sense with the other comments in view.

Their reviews reach the agent like yours do, with their name on each comment. Anyone who signs in without a link sees "This library is private" and nothing else.

## You manage access

`/settings` has three sections:

- **Agents**: API keys. Creating one shows the key once, with the MCP configuration to paste into pi. Each key has a name (`pi on laptop`) that becomes the author of its revisions.
- **Links**: every share, with revoke.
- **People**: everyone who signed in through a link, with the documents they commented on, and a button to remove their access.

## What's left out on purpose

- **Editing in the browser.** The agent writes, you review. A suggestion is the way to change words yourself. A full editor would compete with the agent for the same text and bring conflict handling with it.
- **Live collaboration.** Comments show up on refresh, not in real time. Real-time would need a Durable Object per document and only pays off with several reviewers at once.
- **Notifications.** The agent asks `pending_reviews`; you look at "Waiting for you". Email or webhooks can come later if the asking turns out to be too slow.
