import type { Element, Root } from "hast";
import { toHtml } from "hast-util-to-html";
import { describe, expect, it } from "vitest";

import { render } from "./index";

const REPORT = `# AWS costs, November

EC2 was 41% of the bill, about **$3,100**.

## Data transfer

> [!WARNING]
> Most of it is NAT gateway traffic.

| Service | Cost |
| ------- | ---: |
| EC2     | 3100 |

\`\`\`ts
const total = 7_560;
\`\`\`

\`\`\`mermaid
graph LR; ec2 --> nat --> s3
\`\`\`

Cost per GB is $$c = t / g$$.[^1]

[^1]: From the November invoice.
`;

function find(tree: Root, test: (node: Element) => boolean): Element | undefined {
  const stack = [...tree.children];
  while (stack.length) {
    const node = stack.shift();
    if (node?.type !== "element") continue;
    if (test(node)) return node;
    stack.push(...node.children);
  }
  return undefined;
}

describe("render", () => {
  it("takes the title from a leading heading and removes it from the body", async () => {
    const { title, tree } = await render(REPORT);
    expect(title).toBe("AWS costs, November");
    expect(find(tree, (node) => node.tagName === "h1")).toBeUndefined();
  });

  it("prefers the frontmatter title", async () => {
    const { title } = await render("---\ntitle: Ada dossier\n---\n\n# Overview\n");
    expect(title).toBe("Ada dossier");
  });

  it("returns null without a title", async () => {
    expect((await render("Just a paragraph.")).title).toBeNull();
  });

  it("marks each block with its offsets in the source", async () => {
    const { tree } = await render(REPORT);
    const paragraph = find(tree, (node) => node.tagName === "p");
    const [start, end] = String(paragraph?.properties.dataSourcepos).split("-").map(Number);
    expect(REPORT.slice(start, end)).toBe("EC2 was 41% of the bill, about **$3,100**.");
  });

  it("lists h2 and h3 headings with ids", async () => {
    const { headings } = await render(REPORT);
    expect(headings).toEqual([{ depth: 2, text: "Data transfer", id: "data-transfer" }]);
  });

  it("takes a callout title from the marker's line", async () => {
    const { tree } = await render("> [!IMPORTANT] Importante\n> O código não chega.");
    const callout = find(tree, (node) => node.tagName === "aside");
    expect(toHtml(callout!)).toContain('<p class="callout-title">Importante</p>');
    expect(toHtml(callout!)).toContain("O código não chega.");
  });

  it("turns GitHub alerts into callouts", async () => {
    const { tree } = await render(REPORT);
    const callout = find(tree, (node) => node.tagName === "aside");
    expect(callout?.properties.dataCallout).toBe("warning");
    expect(toHtml(callout!)).toContain("Most of it is NAT gateway traffic.");
    expect(toHtml(callout!)).not.toContain("[!WARNING]");
  });

  it("keeps the footnotes label id", async () => {
    expect(toHtml((await render(REPORT)).tree)).toContain('id="footnote-label"');
  });

  it("highlights code with token classes", async () => {
    const html = toHtml((await render(REPORT)).tree);
    expect(html).toContain('<span class="th-token th-keyword">const</span>');
  });

  it("keeps offsets on highlighted code blocks", async () => {
    const { tree } = await render(REPORT);
    const figure = find(tree, (node) => node.properties.dataKind === "code");
    expect(figure?.properties.dataLanguage).toBe("ts");
    const [start, end] = String(figure?.properties.dataSourcepos).split("-").map(Number);
    expect(REPORT.slice(start, end)).toBe("```ts\nconst total = 7_560;\n```");
  });

  it("draws mermaid blocks as SVG and keeps the source for the browser", async () => {
    const { tree, features } = await render(REPORT);
    const figure = find(tree, (node) => node.properties.dataKind === "diagram");
    const html = toHtml(figure!);
    expect(html).toContain("<svg");
    expect(html).toContain("ec2 --> nat --> s3");
    expect(features).toEqual({ math: true, diagram: true });
  });

  it("keeps line breaks in diagram source", async () => {
    const { tree } = await render("```mermaid\nflowchart LR\n  a --> b\n  b --> c\n```");
    const figure = find(tree, (node) => node.properties.dataKind === "diagram");
    expect(figure?.properties.dataError).toBeUndefined();
    expect(toHtml(figure!)).toContain("flowchart LR\n  a --> b");
  });

  it("leaves display math to KaTeX instead of treating it as code", async () => {
    const { tree } = await render("$$\nx^2\n$$");
    expect(find(tree, (node) => node.properties.dataKind === "code")).toBeUndefined();
    expect(toHtml(tree)).toContain('class="katex-display"');
  });

  it.each([
    "At $0.045 per GB that is about $950.",
    "Between $5 and $10 a month.",
    "From $5-$10 a month.",
    "It costs $5.",
  ])("leaves prices as text: %s", async (source) => {
    const html = toHtml((await render(source)).tree);
    expect(html).not.toContain("katex");
    expect(html).toContain(source.slice(0, -1));
  });

  it("reads $x$ as inline math", async () => {
    const html = toHtml((await render("Saves $c = 0.045 \\times 21{,}000$ dollars.")).tree);
    expect(html).toContain('class="katex"');
    expect(html).toContain("Saves ");
    expect(html).toContain(" dollars.");
  });

  it("shows the source of a diagram Pele cannot draw", async () => {
    const { tree } = await render("```mermaid\nflowchart LR\n  a -->\n```");
    const figure = find(tree, (node) => node.properties.dataKind === "diagram");
    expect(figure?.properties.dataError).toBeTruthy();
    expect(toHtml(figure!)).not.toContain("<svg");
  });

  it("renders math with KaTeX", async () => {
    expect(toHtml((await render(REPORT)).tree)).toContain('class="katex"');
  });

  it("keeps footnote links working", async () => {
    const html = toHtml((await render(REPORT)).tree);
    const href = /href="#(user-content-fn-1)"/.exec(html)?.[1];
    expect(href).toBeDefined();
    expect(html).toContain(`id="${href}"`);
  });

  it("removes scripts and event handlers from raw HTML", async () => {
    const html = toHtml(
      (await render('<script>alert(1)</script><img src="x" onerror="alert(1)">\n\nok')).tree,
    );
    expect(html).not.toContain("script");
    expect(html).not.toContain("onerror");
  });

  it("produces plain text for search", async () => {
    const { text } = await render(REPORT);
    expect(text).toContain("EC2 was 41% of the bill, about $3,100.");
    expect(text).not.toContain("**");
  });
});

describe("links to documents", () => {
  it("marks them with the id, as bare when the text is the address, and as a card when alone", async () => {
    const source = [
      "See [the cache plan](/d/k7q2mxa9pt) and https://ever.example/d/abcdefghij.",
      "",
      "https://ever.example/d/0123456789",
      "",
      "[Elsewhere](https://example.com/d/notanid) stays a plain link.",
    ].join("\n");
    const { tree, links } = await render(source);
    const html = toHtml(tree);
    expect(links).toEqual(["k7q2mxa9pt", "abcdefghij", "0123456789"]);
    expect(html).toContain('<a href="/d/k7q2mxa9pt" data-document="k7q2mxa9pt">');
    expect(html).toMatch(/data-document="abcdefghij" data-bare=""/);
    expect(html).toMatch(
      /<p data-sourcepos="[^"]+" data-card=""><a href="https:\/\/ever.example\/d\/0123456789"/,
    );
    expect(html).toContain('<a href="https://example.com/d/notanid">');
  });
});
