# Writing for evergarden

evergarden renders markdown for a person who reads it carefully and comments on it. Write for that reader: short paragraphs, the answer first, and a figure where it reads faster than prose. At most two or three figures per document, with prose between them.

## Title

The title comes from frontmatter `title`, or else the first `# heading`. Write one of them; the heading becomes the page title and is not repeated in the body.

## Working with documents

- Call `publish` once per document and keep the id it returns, so comments and links stay with the same document.
- To change a few passages, call `edit` with the exact text to replace. Edits collect in a draft that readers do not see; call `publish_draft` once the change is whole, so it becomes one version. Call `update` only to replace the whole text, with `base_version` when your user may have changed it since you read it.
- Working in a git repository, pass `repo` with its remote URL: the document is filed in the folder linked to it, and `list(repo)` finds everything written about it.
- `share` sets who else can open a document or folder. Call it only when your user asks.

## Markdown

GitHub-flavoured markdown: tables, task lists, footnotes (`[^1]`), autolinks, strikethrough. Raw HTML is sanitised: no scripts, styles or event handlers.

Callouts are GitHub alerts: `> [!NOTE]`, `TIP`, `IMPORTANT`, `WARNING` or `CAUTION`. Text after the marker becomes the title, so a document in another language can say `> [!WARNING] Atenção`.

Math uses KaTeX: `$x^2$` or `$$x^2$$` inline, and `$$` on lines of their own around a block. Prices need no escaping: a `$` followed by a space, or one right before a digit, never closes math, so "$5 and $10" stays text.

Code is highlighted in about 80 languages, PromQL among them; name the language after the opening fence (`ts`, `sql`, `promql`).

## Links to other documents

Link with the document's address: `[the cache plan](/d/<id>)` shows with a document icon. A bare `https://…/d/<id>` takes the document's current title, and a link alone in its paragraph becomes a card with the title, folder and age. A reader who may not open the linked document sees the text without a link.

## Icons

`:icon[name]` draws an icon inline, in the colour of the text around it: `## :icon[rocket] Launch`. Names: check, check-circle, x, x-circle, warning, warning-circle, info, question, lightbulb, rocket, rocket-launch, flag, target, clock, calendar, hourglass, timer, lightning, fire, star, heart, sparkle, thumbs-up, thumbs-down, bug, wrench, hammer, gear, gauge, lock, lock-open, key, shield, prohibit, user, users, robot, brain, chat-circle, envelope, megaphone, bell, link, globe, cloud, database, hard-drives, cpu, code, terminal, git-branch, git-pull-request, package, file, folder, list-checks, chart-line, chart-bar, trend-up, trend-down, currency-dollar, money, scales, arrow-right, arrow-up, arrow-down, plus, minus, pencil, trash, eye, magnifying-glass, book, graduation-cap, puzzle-piece, coffee, house, map-pin. Any other name stays as written.

## Tabs and details

Tabs hold alternatives, such as the same command for two tools. Each `::tab[label]` line starts a tab:

````
:::tabs
::tab[bun]
```sh
bun add pele
```
::tab[npm]
```sh
npm install pele
```
:::
````

`:::details[Summary]` … `:::` folds long content, such as a full log, behind its summary.

## Formulas

When a query, alert rule or piece of code computes a number, show what it computes as a formula first, and the code in a tab beside it. Name the quantities with short symbols, say what each one is in the sentence after, and leave the label names, units and filters to the code:

````
:::tabs
::tab[Formula]
$$
u = \frac{T_{\text{month}} + \dfrac{T_{7d}}{7}\,(D - d + 1)}{A}
$$

$T_{\text{month}}$ is this month's traffic so far, $T_{7d}$ the last seven days', $D$ the days in
the month, $d$ today and $A$ the allowance. The alert fires when $u > 1$.
::tab[PromQL]
```promql
(
  max(hedy_zone_traffic_bytes{service_name="hedy"})
  + max(hedy_zone_traffic_week_bytes{service_name="hedy"}) / 7
    * (days_in_month() - day_of_month() + 1)
)
/ max(hedy_zone_allowance_bytes{service_name="hedy"})
```
:::
````

Write the formula from the code, not from memory, and keep them saying the same thing: when one changes, change the other. Use `\frac` for division, `\cdot` or a thin space `\,` for products, `\lceil x \rceil` for `ceil`, `\max` and `\sum_{z}` for aggregations, and `\text{…}` for words inside math.

## Figures

Figures are drawn from plain markdown inside `::name{title="…"}` … `::`, after the grammar of [mdxcn](https://mdxcn.dev). The title is optional. Inside them:

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

## Diagrams

A ` ```mermaid ` block is drawn by [Pele](https://pele.run), which reads Mermaid syntax. Diagrams adapt to narrow screens, so prefer them to ASCII drawings. Colours come from the page in light and dark, so do not set a theme or colours.

| Diagram                                                                                                                    | Good for                                           |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `flowchart`                                                                                                                | Processes and request paths; `subgraph` groups     |
| `sequenceDiagram`                                                                                                          | Who calls whom, in order                           |
| `stateDiagram-v2`                                                                                                          | States and transitions                             |
| `classDiagram`, `erDiagram`                                                                                                | Types and tables                                   |
| `gantt`, `timeline`                                                                                                        | Schedules and history                              |
| `xychart`                                                                                                                  | Bars and lines over a shared axis                  |
| `pie`, `treemap-beta`                                                                                                      | Parts of a whole                                   |
| `sankey`                                                                                                                   | Flows between stages, such as a budget or a funnel |
| `quadrantChart`                                                                                                            | Items placed on two axes                           |
| `radar-beta`                                                                                                               | Several options scored on the same criteria        |
| `venn-beta`                                                                                                                | Overlapping sets                                   |
| `mindmap`, `treeView-beta`                                                                                                 | Hierarchies, and file trees with notes             |
| `architecture-beta`, `C4Context`                                                                                           | Systems and their parts                            |
| `kanban`, `journey`, `gitGraph`, `packet`, `block`, `requirementDiagram`, `swimlane-beta`, `wardley-beta`, `ishikawa-beta` | What their names say                               |

Examples of each are at https://pele.run/examples.md.

- Name every series in an `xychart` and every curve in a `radar-beta`: `bar "hedy" [...]` and `line "Bright Data" [...]`. The chart draws a legend with their colours, so the title need not say which is the bar and which the line. `pie` names its slices the same way.
- Quote labels that hold anything but letters and digits: `x-axis ["14/10", "15/10"]`.
- Settings go in frontmatter at the top of the block. Values on the bars, for instance:

  ```
  ---
  config:
    xyChart:
      showDataLabel: true
  ---
  xychart
    ...
  ```

- A `;` ends a Mermaid statement, so a message or label that needs a pause takes a comma: "version 2, with your comment" draws, and "version 2; your comment" fails to parse.
