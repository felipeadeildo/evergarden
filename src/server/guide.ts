/** What `guide()` returns until the owner picks an authoring guide document in settings. */
export const SYNTAX_GUIDE = `# Writing for evergarden

evergarden renders GitHub-flavoured markdown for a person who reads it carefully and comments on it.

## Title

The title comes from frontmatter \`title\`, or else the first \`# heading\`. Write one of them; the
heading is shown as the page title and not repeated in the body.

## What renders

- Tables, task lists, footnotes (\`[^1]\`), autolinks, strikethrough.
- Callouts, written as GitHub alerts:

  > [!NOTE]
  > One of NOTE, TIP, IMPORTANT, WARNING or CAUTION.

  Text after the marker becomes the title, so a document in another language can say
  \`> [!WARNING] Atenção\`.

- Math with KaTeX: \`$x^2$\` or \`$$x^2$$\` inline, and \`$$\` on lines of their own around a
  block. Prices need no escaping: a \`$\` followed by a space, or one that sits right before a
  digit, never closes math, so "$5 and $10" stays text.
- Diagrams in a \`\`\`mermaid code block, in Mermaid syntax: flowcharts, sequence, state, class,
  ER, gantt, timeline, mindmap, xychart, sankey, architecture, tree view and the rest. They adapt
  to narrow screens, so prefer them to ASCII drawings. In Mermaid a \`;\` ends a statement, so a
  message or label that needs a pause takes a comma: "version 2, with your comment" draws, and
  "version 2; your comment" fails to parse.
- In an \`xychart-beta\`, name every series, \`bar "hedy" [...]\` and \`line "Bright Data" [...]\`: the
  chart draws a legend with their colours, so the title need not say which is the bar and which
  the line. Quote axis labels that hold anything but letters and digits: \`x-axis ["14/10", "15/10"]\`.
- Highlighted code in about 80 languages; name the language after the opening fence.
- Links to other documents: \`[the cache plan](/d/<id>)\` shows with a document icon, and a
  bare \`/d/<id>\` URL takes the document's current title. A link alone in its paragraph becomes
  a card with the title, folder and age. Readers who may not open the linked document see the text
  without a link.

Raw HTML is sanitised: no scripts, styles or event handlers.

## Working with documents

- Call \`publish\` once per document. Keep the id it returns, so comments and links stay attached
  to the same document.
- To change a few passages, call \`edit\` with the exact text to replace. Edits collect in a draft
  that readers do not see; call \`publish_draft\` once the change is whole, so it becomes one
  version. Call \`update\` only to replace the whole text.
- When working inside a git repository, pass \`repo\` with its remote URL. The document is filed in
  the folder linked to that repository, and \`list(repo)\` finds everything written about it.
- Pass \`base_version\` to \`update\` when the owner may have edited the document since you read it.
`;
