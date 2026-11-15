# Figures

Write a figure as plain markdown between `::name{title="…"}` and a closing `::` line, in the grammar of [mdxcn](https://mdxcn.dev). The title is optional. Inside a figure:

- `**bold**` marks the row to read: now, chosen, the total. `*italic*` recedes: next, rejected, an aside.
- `- label: value` is one row; the label is everything before the first `: `.
- `—` (an em dash with spaces) starts a note, shown muted after the item.
- `a → b → c` is a path; `->` works too.

| Figure     | Use it for                                 | Write                                            |
| ---------- | ------------------------------------------ | ------------------------------------------------ |
| `timeline` | Events in order, one marked as now         | `- 14:11: rolled back` per event                 |
| `steps`    | A procedure                                | `1. **Step**` then an indented paragraph         |
| `check`    | A punch list                               | `- [x] done` and `- [ ] open`                    |
| `decision` | A tradeoff: what you picked and why        | `- **Picked** — why`, `- *Rejected* — why`       |
| `tree`     | Nested files or an org chart               | A nested list, `— note` after any item           |
| `stat`     | Two to four headline numbers               | `- **860** shipped`                              |
| `spec`     | Aligned label and value rows               | `- Family: Literata`                             |
| `flow`     | A pipeline or request path                 | `request → **middleware** → handler`, one a line |
| `board`    | Now, next, later, or todo, doing, done     | `### Now` then a list, per column                |
| `faq`      | Questions people keep asking               | `### Question?` then the answer                  |
| `keys`     | Keyboard shortcuts                         | `- ⌘K: search`, `- Ctrl+Shift+P: palette`        |
| `rank`     | Values sorted highest first, drawn as bars | `- 12,400 /docs`                                 |
| `meter`    | One share between 0 and 100%               | `67% — of the disk`                              |

```
::timeline{title="Incident"}
- 14:02: p95 crossed 800ms — paged the on-call
- **14:11: rolled back the cache flag**
- *14:40: write the postmortem*
::

::decision{title="Database"}
- **Postgres** — we already run it
- *Mongo* — no joins we trust

Revisit if writes pass 2k a second.
::
```

mdxcn's `graph-` names work too: `::graph-timeline` is `::timeline`. Write the body as markdown; YAML props are not read.
