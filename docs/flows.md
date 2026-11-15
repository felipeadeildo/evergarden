# How evergarden is used

One document, from the moment an agent writes it to the moment someone else reads it. How it is built is in [design.md](design.md); how it looks is in [design-language.md](design-language.md).

The example is a cost report: your agent reads last month's AWS bill and writes "AWS costs, November", with two tables and a mermaid diagram.

## The agent publishes

Before its first document, the agent calls `guide()`, which returns what evergarden renders and how to work with documents. Then:

```
publish(content: "# AWS costs, November\n…", folder: "reports/2026")
→ Published k7q2mxa9pt, version 1: https://docs.example.com/d/k7q2mxa9pt
```

`k7q2mxa9pt` is the document's only address: ten random lower-case letters and digits. The title comes from the frontmatter `title`, or else the first `#` heading. `publish` creates the folders it names.

A folder can be linked to a repository. An agent working inside `github.com/ranqia/ada` publishes with `repo: "github.com/ranqia/ada"` and the document lands in the linked folder; `list(repo: …)` returns everything written about that repository.

## You open the library

`/` lists the recently updated documents, with a dot on the ones changed since you last opened them, then your folders. A folder opens at `/f/<id>` and shows what it holds, 50 documents at a time.

Search (`⌘K`, or the search button on a phone) matches titles first, then the full text.

## You read the report

`/d/k7q2mxa9pt` shows the title, a line saying who updated it and when, and the text. Comments sit in the right margin on screens at least 1,200 px wide; on smaller screens a passage stays marked and tapping it opens the comment in a sheet. Long documents get a table of contents, in the left column on wide screens and behind a button otherwise.

The top bar shows the folder the document is in. Clicking it lists what that folder holds and climbs to the folders above, so you can open another document without going back to the library.

A diagram takes the width of the text. Clicking it opens it full screen, where you scroll, drag and pinch to zoom.

## You comment on it

A comment is posted when you save it, as in Google Docs, and the agent can read it right away.

| You point at                                     | How                                                | The comment is attached to                 |
| ------------------------------------------------ | -------------------------------------------------- | ------------------------------------------ |
| Text in a paragraph, list, heading or table cell | Select it, then the ☜ in the gutter or `⌘⌥M`       | That passage, marked in emerald            |
| A whole table, code block or callout             | The ☜ in the gutter beside the block               | The block, outlined while it has a comment |
| A spot in a diagram                              | The ☜ beside the diagram, then a click on the spot | A numbered pin on that spot                |

On a phone, selecting text brings a bar to the bottom of the screen, clear of the system menu, with **Comment** and **Suggest**.

**Suggest** opens the note with the selected text in the box. You edit it, and the note shows the change word by word. **Accept** saves a new version with the change and resolves the comment.

Anyone who can comment can reply. **Resolve** takes a comment out of the margin. A resolved comment belongs to the version it was resolved on: the versions menu lists it under that version, and opening it there shows that version with the comment on its passage. `J` and `K` move between comments, `Esc` closes one.

## The agent works through the comments

When you tell the agent "look at my comments", it calls `open_comments(id)`, or `open_comments()` for every document, unseen first. It gets markdown it can act on:

```
## AWS costs, November (k7q2mxa9pt), version 1

### c_31 on text, open
> Data transfer is the second biggest line item.
Context: …about $3,100. >>>Data transfer is the second biggest line item.<<< Most of it left through…
- felipe: Is this NAT gateway traffic? Say so.

### c_32 on the table "Cost by service", open
- felipe: Sort by cost, not by service name.
```

Then it replies with `reply(comment_id, body)`, accepts a suggestion with `accept_suggestion(comment_id)`, or rewrites and calls `update(id, content)` followed by `resolve(comment_id, note)`.

## The agent updates the document

`update` saves version 2. Saving the same content twice returns the existing version, so a retry does no harm. With `base_version`, the call fails if someone saved a version in between, instead of overwriting it.

Each open comment follows its passage into the new text, even when the paragraph moved. A comment whose passage was rewritten beyond recognition leaves the margin for "1 on changed text", above it, quoting the old text.

The line under the title opens the list of versions, each with the comments resolved on it. An older version opens with a banner linking back to the current one. Nobody comments on an older version, and there is no diff view.

## You share it

A document has one address, and so does a folder. Sharing changes who may open that address; it never makes a new one. **Share**, in the top bar, sets:

| Choice          | Options                                             | Default          |
| --------------- | --------------------------------------------------- | ---------------- |
| Who can open it | Only you; people I list; anyone with the link       | Only you         |
| They can        | Read; read and comment                              | Read             |
| Versions        | Only the current one; all versions (documents only) | Only the current |
| Stops working   | Never, in 7 days, in 30 days                        | Never            |

"People I list" takes emails and whole domains, `ana@acme.com` or `@acme.com`. No invitation is sent: they open the address and sign in with a code sent to their email.

Each choice applies at once. A sentence under the choices says what is in force ("ana@acme.com and @acme.com can read, the current version only"), the Share button names it ("Only you", "Link, read"), and the library marks what is shared. Sharing a folder shares everything inside it, including what agents publish there later; a document's own setting can only open it further.

## Someone opens your link

The chat app's preview already shows the title and the first sentence.

- **Anyone with the link, to read**: they read with no sign-in. The top bar has no search or settings, and the folder path starts at the shared folder.
- **Anyone with the link, to comment**: the same, plus **Sign in to comment**, by a code sent to their email. They comment and reply as you do; resolving and accepting stay with you and your agents.
- **People you listed**: they sign in with an email code first, then read or comment as above.

With "Only the current one", guests see neither older versions nor the comments resolved on them. Codes go only to you, to people listed on a shared page, and to people signing in to comment on a link; anyone else gets no email.

## You manage access

Agents sign in with OAuth. You give the agent only the address:

```
pi mcp add evergarden --url https://docs.example.com/mcp
```

The first time, the agent opens your browser on `/connect`: "pi wants to read, publish and update the documents in your library", with a name you can change ("pi on laptop"). From then on the agent signs what it writes with that name.

`/settings` shows that command for pi, Claude Code, Codex and Gemini CLI, and creates API keys for clients without OAuth. It also lists:

- **Connected agents**, with how each connected, when it was last seen, and **Revoke**, which stops even an unexpired token at once.
- **Shared**: everything you shared, with the policy in force and **Stop sharing**.
- **People**: everyone who signed in as a guest, with **Remove**, which signs them out; their comments stay.

## Left out on purpose

- **Diffs and review rounds.** Comments post one at a time.
- **Editing in the browser.** The agent writes; you comment and suggest.
- **Live updates.** New comments appear when you reload or come back to the tab.
- **Notifications.** The agent asks `open_comments`; you look at the library.
