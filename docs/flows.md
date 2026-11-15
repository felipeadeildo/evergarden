# How evergarden is used

One document, from the moment an agent writes it to the moment someone else reads it. How it is built is in [design.md](design.md); how it looks is in [design-language.md](design-language.md).

The example is a cost report: your agent reads last month's AWS bill and writes "AWS costs, November", with two tables and a mermaid diagram.

## The agent publishes

Before its first document, the agent calls `guide()`, which returns what evergarden renders and how to work with documents. Then:

```
publish(content: "# AWS costs, November\n…", folder: "reports/2026")
→ Published k7q2mxa9pt, version 1: https://docs.example.com/d/k7q2mxa9pt
```

`k7q2mxa9pt` is the document's only address: ten random lower-case letters and digits. The title comes from the frontmatter `title`, or else the first `#` heading. A frontmatter `summary` shows under the title, in link cards and in link previews. `publish` creates the folders it names.

A folder can be linked to a repository. An agent working inside `github.com/ranqia/ada` publishes with `repo: "github.com/ranqia/ada"` and the document lands in the linked folder; `list(repo: …)` returns everything written about that repository.

## You open the library

`/` lists the recently updated documents, with a dot on the ones changed since you last opened them, then your folders. A folder opens at `/f/<id>` and shows what it holds, 50 documents at a time.

Search (`⌘K`, or the search button on a phone) matches titles first, then the full text.

## You read the report

`/d/k7q2mxa9pt` shows the title, a line saying who updated it and when, and the text. Comments sit in the right margin on screens at least 1,200 px wide; on smaller screens a passage stays marked and tapping it opens the comment in a sheet. Long documents get a table of contents, in the left column on wide screens and behind a button otherwise.

The top bar shows the folder the document is in. Clicking it lists what that folder holds and climbs to the folders above, so you can open another document without going back to the library.

A diagram takes the width of the text. Clicking it opens it full screen, where you scroll, drag and pinch to zoom.

Agents can write more than markdown: figures such as timelines, decisions and boards in mdxcn's grammar, tabs, folded details, and Phosphor icons inline. A link to another document shows its current title, or a card when it stands alone; a reader who may not open it sees plain text. `guide()` gives agents the essentials in about 2 KB, and `guide(topic)` the details of figures, diagrams, formulas or icons; the text lives in `src/server/guide/`.

Beside the byline, **Copy**, **.md** and **PDF** copy the markdown, download it as a file, or print the document, which is also how it becomes a PDF: the print stylesheet leaves out the bars, the margin and the comments.

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

To change a few passages, the agent calls `edit(id, [{ old, new }])`. Each `old` must appear exactly once. Edits collect in a draft that only you see, as the first entry of the versions menu, with **Publish** and **Discard**. `publish_draft` turns the draft into one version, credited to the agent that wrote it; it fails if someone saved a version since the draft began.

`update` replaces the whole text and saves version 2. Saving the same content twice returns the existing version, so a retry does no harm. With `base_version`, the call fails if someone saved a version in between, instead of overwriting it.

Each open comment follows its passage into the new text, even when the paragraph moved. A comment whose passage was rewritten beyond recognition leaves the margin for "1 on changed text", above it, quoting the old text.

The line under the title opens the list of versions, each with the comments resolved on it. An older version opens with a banner linking back to the current one. Nobody comments on an older version, and there is no diff view.

## It carries files

A document can carry files beside its markdown, like a folder with `index.md` and what it uses. The markdown names them plainly. `![chart](chart.png)` shows the image, `[the data](data.csv)` becomes a download button with the size, and a **Files** list after the text has them all.

The agent calls `attach(id, name, content_base64)`, or sends larger files with `curl -T` to `/api/v1/documents/<id>/files/<name>`. You attach with **Attach files** or by dropping them on that list. Either way the files go into the draft, and readers get them with the next version. Each version keeps its own files, so an old version still shows its old chart. A file is at most 10 MB, a document at most 100 MB of them.

## It sits in a folder

When a folder holds other documents, the side column lists them above the contents. **Previous** and **Next** after the text, and the `[` and `]` keys, open the neighbours. On a phone the list is in the Contents sheet. A guest sees the neighbours only when a folder above was shared with them.

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
- **Trash**: deleted documents for 30 days, with **Restore** and **Delete forever**.

## You organize it

Each folder has an **Order**: Manual, Newest first, Oldest first, or Title A–Z. New documents go last, so a series keeps the order it was published in. Dragging a row by its handle moves it and turns the folder Manual, starting from the order on screen; the handle's menu does the same with **Move up** and **Move down**, from the keyboard or a phone. One document can be the folder's entry: it sits first under **Start here** with its summary, set from the handle's menu or with `index: true` in its frontmatter. The order holds everywhere the folder shows: its page, the side list, Previous and Next, guests, and `list`. Agents change it with `order`.

Beside the title, **Rename**, **Move** and **Delete** act on the document; a folder's page has the same three for the folder. Renaming a document saves a version with the new title in its markdown, so the exported `.md` and the agents see the new title too. Move picks a folder from the tree, or creates one from a typed path such as `reports/2027`. A folder moves with everything in it, and cannot go inside itself.

Delete sends documents to the trash and stops sharing them at once. Deleting a folder sends every document under it to the trash with the path it came from. Restoring one recreates its folders. Agents can `move`, `rename` and `delete`; their deletions go to the same trash.

## Left out on purpose

- **Diffs and review rounds.** Comments post one at a time.
- **Editing in the browser.** The agent writes; you comment and suggest.
- **Live updates.** New comments appear when you reload or come back to the tab.
- **Notifications.** The agent asks `open_comments`; you look at the library.
