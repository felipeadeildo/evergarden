# Writing for evergarden

Your user reads these documents closely and comments on passages. Put the answer first, keep paragraphs short, and use a figure only where it reads faster than prose: two or three per document at most.

The title is frontmatter `title` or the first `# heading`, not both. A frontmatter `summary` of one sentence shows under the title, in link cards and in link previews; write one for any document longer than a screen.

## Working with documents

- `publish` once per document, then keep its id: comments and links follow the id.
- `edit` replaces exact passages in a draft only your user sees; `publish_draft` saves the draft as one version. `update` replaces the whole text; pass `base_version` if your user may have changed it.
- In a git repository, pass `repo` (the remote URL) so the document lands in that repository's folder.
- `share` changes who can open a document or folder. Call it only when your user asks.

## Markdown

- GitHub markdown: tables, task lists, footnotes, autolinks. Raw HTML loses scripts, styles and event handlers.
- Callouts: `> [!NOTE]`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`. Text after the marker is the title: `> [!WARNING] Atenção`.
- Math: `$x$` inline, `$$` on their own lines for a block. Prices stay text: "$5 and $10".
- Code: name the language after the fence (`ts`, `sql`, `promql`, about 80 more).
- Links to documents: `[the cache plan](/d/<id>)`. A bare document URL shows its title; alone in a paragraph it becomes a card.
- Mermaid blocks are drawn as diagrams. Do not set a theme or colours.
- Tabs for alternatives, details to fold a long log:

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

:::details[Full log]
...
:::
````

## What else you can write

Each of these has its syntax and examples behind `guide(topic)`. Call it when the document needs one.

| When the document has                                                                                        | Call                |
| ------------------------------------------------------------------------------------------------------------ | ------------------- |
| Events in order, a procedure, a punch list, a tradeoff, a few headline numbers, a file tree, a roadmap board | `guide("figures")`  |
| A process, calls between services, a schema, a chart over time, parts of a whole                             | `guide("diagrams")` |
| A query, alert rule or code that computes a number                                                           | `guide("formulas")` |
| A heading or status that an icon would make easier to scan                                                   | `guide("icons")`    |
| An image, a dataset, a PDF or anything else to show or hand over beside the text                             | `guide("files")`    |
