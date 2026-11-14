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

- Math with KaTeX: \`$x^2$\` inline, \`$$ … $$\` on its own lines.
- Diagrams in a \`\`\`mermaid code block, in Mermaid syntax: flowcharts, sequence, state, class,
  ER, gantt, timeline, mindmap, xychart, sankey, architecture, tree view and the rest. They adapt
  to narrow screens, so prefer them to ASCII drawings.
- Highlighted code in about 80 languages; name the language after the opening fence.

Raw HTML is sanitised: no scripts, styles or event handlers.

## Working with documents

- Call \`publish\` once per document. Keep the id it returns and call \`update\` for every later
  change, so comments and links stay attached to the same document.
- When working inside a git repository, pass \`repo\` with its remote URL. The document is filed in
  the folder linked to that repository, and \`list(repo)\` finds everything written about it.
- Pass \`base_version\` to \`update\` when the owner may have edited the document since you read it.
`;
