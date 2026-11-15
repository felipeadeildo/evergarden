# Figures

Write a figure as plain markdown between `::name{title="…"}` and a closing `::` line, in the grammar of [mdxcn](https://mdxcn.dev). The title is optional, and `::graph-timeline` works the same as `::timeline`. Inside any figure:

- `**bold**` marks what to read first: now, chosen, the total. `*italic*` recedes: next, rejected, an aside.
- `- label: value` is one row. The label is everything before the first `: `.
- `—` (an em dash between spaces) starts a note, shown muted after the item.
- Leave a blank line before the closing `::` when the figure ends with prose rather than a list.

Use one where it reads faster than prose, and two or three per document at most.

## timeline

Events in order. Bold is now, italic is next, the rest is done.

```
::timeline{title="Incident, 14 Nov"}
- 14:02: p95 crossed 800 ms — paged the on-call
- 14:06: traced to the cache flag
- **14:11: rolled back the flag**
- *14:40: write the postmortem*
::
```

## steps

A procedure. Bold each step's name and indent its detail under it.

```
::steps
1. **Create the database**

   Run `wrangler d1 create evergarden`.

2. **Apply migrations**

   Run `bun run db:migrate`.
::
```

## check

A punch list, ticked or open.

```
::check{title="Before the launch"}
- [x] Migrations applied
- [x] Email sending verified — from noreply@adeildo.dev
- [ ] Custom domain
::
```

## decision

A tradeoff: bold is chosen, italic is rejected, plain is still open. A paragraph after the list is the note under it.

```
::decision{title="Database"}
- **Postgres** — we already run it
- *Mongo* — no joins we trust
- SQLite — fine until a second writer

Revisit if writes pass 2k a second.
::
```

## tree

Nested files or an org chart, with a note after any item.

```
::tree
- src
  - render — markdown to HTML
  - **server** — the Worker
    - mcp.ts
  - *legacy* — to delete
::
```

## stat

Two to four headline numbers. Each row starts with the number, and a unit right after it stays with it: `16,5 h`, `800 ms`, `14.7 TB`. Bold the row to lead.

```
::stat
- **1.30M** answers on Saturday
- 99.93% succeeded
- 49% of the byte allowance — by day 15
::
```

## spec

Aligned label and value rows.

```
::spec{title="Typeface"}
- Family: Literata
- Body: 19 px, line height 1.6
- **Measure: 66 characters**
::
```

## flow

A pipeline or request path, one path per line. Bold is the step in focus, italic the optional one.

```
::flow
request → **middleware** → handler → D1
request -> *cache* -> handler
::
```

## board

Columns such as now, next, later, each a `###` heading with a list. Each column shows its count.

```
::board
### Now
- **Sharing by email**
- Drafts

### Next
- PDF export

### Later
- *Offline reading*
::
```

## faq

Questions and their answers.

```
::faq
### Who can open a shared page?
Whoever it was shared with: a link, or listed emails and domains.

### Do guests need an account?
No. They sign in with a code sent to their email.
::
```

## keys

Keyboard shortcuts. Write `+` between keys.

```
::keys
- ⌘+K: search
- Esc: close a comment
- Ctrl+Shift+P: command palette
::
```

## rank

Values sorted highest first and drawn as bars. The number comes first; bold the one to look at.

```
::rank{title="Traffic by path"}
- 12,400 /docs
- **8,100 /pricing**
- 2,300 /blog
::
```

## meter

One share between 0 and 100%, with an optional note.

```
::meter{title="Disk"}
67% — of 500 GB
::
```
