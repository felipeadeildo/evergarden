import GithubSlugger from "github-slugger";
import type { Element, ElementContent, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toString } from "hast-util-to-string";
import { toText } from "hast-util-to-text";
import type { Root as MdastRoot } from "mdast";
import { PeleError, render as renderDiagram } from "pele";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { parse as parseYaml } from "yaml";

import { highlighter } from "./highlight";

export type Heading = { depth: 2 | 3; text: string; id: string };

export type RenderData = {
  frontmatterTitle?: string;
  title?: string;
  headings?: Heading[];
  text?: string;
  features?: { math: boolean; diagram: boolean };
};

declare module "vfile" {
  interface DataMap {
    evergarden: RenderData;
  }
}

const CALLOUTS = new Set(["note", "tip", "important", "warning", "caution"]);
const SOURCEPOS_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "aside",
  "figure",
  "pre",
  "ul",
  "ol",
  "li",
  "table",
  "tr",
  "th",
  "td",
  "hr",
  "img",
  "details",
]);

function data(file: VFile): RenderData {
  file.data.evergarden ??= {};
  return file.data.evergarden;
}

export function remarkFrontmatterTitle() {
  return (tree: MdastRoot, file: VFile) => {
    const yaml = tree.children.find((node) => node.type === "yaml");
    if (!yaml) return;
    try {
      const parsed: unknown = parseYaml(yaml.value);
      if (parsed && typeof parsed === "object" && "title" in parsed) {
        const title = String(parsed.title).trim();
        if (title) data(file).frontmatterTitle = title;
      }
    } catch {
      // Malformed frontmatter is left out of the page rather than failing the render.
    }
  };
}

/** Runs after sanitising, so it only adds trusted structure. */
export function rehypeEvergarden() {
  return (tree: Root, file: VFile) => {
    const result = data(file);
    const features = { math: false, diagram: false };

    visit(tree, "element", (node, index, parent) => {
      const offsets = sourceOffsets(node);
      if (offsets && SOURCEPOS_TAGS.has(node.tagName)) node.properties.dataSourcepos = offsets;

      if (node.tagName === "blockquote") toCallout(node);

      if (node.tagName === "code" && hasClass(node, "language-math")) features.math = true;

      if (node.tagName === "pre" && parent && index !== undefined) {
        const code = node.children.find(isElement);
        // Display math is a code block too; KaTeX renders it later.
        if (code?.tagName === "code" && !hasClass(code, "language-math")) {
          const language = languageOf(code);
          if (language === "mermaid") features.diagram = true;
          parent.children[index] =
            language === "mermaid"
              ? diagramFigure(toString(code), offsets)
              : codeFigure(node, language, offsets);
          return SKIP;
        }
      }
      return undefined;
    });

    result.title = takeTitle(tree, result.frontmatterTitle);
    result.headings = addHeadingIds(tree);
    result.text = toText(tree).replace(/\s+/g, " ").trim();
    result.features = features;
  };
}

/** Drops positions once every block carries `data-sourcepos`, which keeps the stored tree small. */
export function rehypeStripPositions() {
  return (tree: Root) => {
    visit(tree, (node) => {
      delete node.position;
    });
  };
}

function sourceOffsets(node: Element): string | undefined {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return undefined;
  return `${start}-${end}`;
}

function isElement(node: ElementContent): node is Element {
  return node.type === "element";
}

function hasClass(node: Element, name: string): boolean {
  const className = node.properties.className;
  return Array.isArray(className) && className.includes(name);
}

/**
 * `> [!NOTE]` becomes `<aside class="callout" data-callout="note">`, as on GitHub. Text after the
 * marker on its line replaces the title, as in Obsidian: `> [!IMPORTANT] Importante`.
 */
function toCallout(node: Element): void {
  const paragraph = node.children.find(isElement);
  const first = paragraph?.children[0];
  if (paragraph?.tagName !== "p" || first?.type !== "text") return;

  const match = /^\[!(\w+)\][ \t]*([^\n]*)\n?/.exec(first.value);
  const kind = match?.[1]?.toLowerCase();
  const title = match?.[2]?.trim();
  if (!match || !kind || !CALLOUTS.has(kind)) return;

  first.value = first.value.slice(match[0].length);
  if (!first.value) paragraph.children.shift();
  if (paragraph.children.length === 0) node.children.splice(node.children.indexOf(paragraph), 1);

  node.tagName = "aside";
  node.properties.className = ["callout"];
  node.properties.dataCallout = kind;
  node.children.unshift({
    type: "element",
    tagName: "p",
    properties: { className: ["callout-title"] },
    children: [{ type: "text", value: title || kind[0]!.toUpperCase() + kind.slice(1) }],
  });
}

function languageOf(code: Element): string | undefined {
  const className = code.properties.className;
  if (!Array.isArray(className)) return undefined;
  const language = className.find((name) => name.startsWith("language-"));
  return language?.slice("language-".length);
}

function codeFigure(
  pre: Element,
  language: string | undefined,
  offsets: string | undefined,
): Element {
  delete pre.properties.dataSourcepos;
  const html = highlighter.highlightToHtml(toString(pre), { lang: language });
  const highlighted = fromHtml(html, { fragment: true }).children.find(isElementLike);
  return {
    type: "element",
    tagName: "figure",
    properties: {
      dataKind: "code",
      dataLanguage: language && highlighter.normalizeLanguage(language),
      dataSourcepos: offsets,
    },
    children: [highlighted ?? pre],
  };
}

/**
 * Drawn on the server so the diagram shows before any script runs; the browser draws it again
 * from the hidden source, at the width it really has.
 */
function diagramFigure(source: string, offsets: string | undefined): Element {
  const figure = (children: Element[], error?: string): Element => ({
    type: "element",
    tagName: "figure",
    properties: { dataKind: "diagram", dataSourcepos: offsets, dataError: error },
    children,
  });
  const sourceNode = (hidden: boolean): Element => ({
    type: "element",
    tagName: "pre",
    properties: { className: ["diagram-source"], hidden },
    children: [{ type: "text", value: source }],
  });

  try {
    const { svg } = renderDiagram(source, {
      fontFamily: "Literata Variable, Georgia, serif",
      idPrefix: `diagram-${offsets ?? "0"}`,
    });
    const drawing: Element = {
      type: "element",
      tagName: "div",
      properties: { className: ["diagram"] },
      children: fromHtml(svg, { fragment: true, space: "svg" }).children.filter(isElementLike),
    };
    return figure([drawing, sourceNode(true)]);
  } catch (error) {
    if (!(error instanceof PeleError)) throw error;
    return figure([sourceNode(false)], error.message);
  }
}

function isElementLike(node: { type: string }): node is Element {
  return node.type === "element";
}

/** The frontmatter title wins; otherwise a leading `# heading`, which then leaves the body. */
function takeTitle(tree: Root, frontmatterTitle: string | undefined): string | undefined {
  const firstIndex = tree.children.findIndex((node) => node.type === "element");
  const first = tree.children[firstIndex];
  const leadingH1 = first?.type === "element" && first.tagName === "h1" ? first : undefined;
  const h1Text = leadingH1 ? toText(leadingH1).trim() : undefined;

  if (leadingH1 && (!frontmatterTitle || frontmatterTitle === h1Text)) {
    tree.children.splice(firstIndex, 1);
  }
  return frontmatterTitle ?? (h1Text || undefined);
}

function addHeadingIds(tree: Root): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  visit(tree, "element", (node) => {
    const depth = /^h([1-6])$/.exec(node.tagName)?.[1];
    // Headings that already have an id come from remark, like the hidden footnotes label.
    if (!depth || node.properties.id) return;
    const text = toText(node).trim();
    const id = slugger.slug(text);
    node.properties.id = id;
    if (depth === "2") headings.push({ depth: 2, text, id });
    if (depth === "3") headings.push({ depth: 3, text, id });
  });
  return headings;
}
