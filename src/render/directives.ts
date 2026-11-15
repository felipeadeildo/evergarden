import type { Paragraph, Root, RootContent, Text } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { ICON_NAMES } from "./icons";

/** Figures drawn from markdown, after mdxcn's grammar: https://mdxcn.dev */
export const FIGURES = new Set([
  "board",
  "check",
  "decision",
  "faq",
  "flow",
  "keys",
  "meter",
  "rank",
  "spec",
  "stat",
  "steps",
  "timeline",
  "tree",
]);

const COMARK_OPEN = /^::([a-z][\w-]*)(?:\{[^}]*\})?\s*$/;
const COMARK_CLOSE = /^::\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * mdxcn writes its blocks the Comark way, `::name{…}` then markdown then `::`, but markdown reads
 * a `::` line right after a list as part of the list. This blanks each closing line, keeping its
 * length so source offsets hold, and returns where each block ends.
 */
export function maskComarkClosers(source: string): { masked: string; closers: number[] } {
  const closers: number[] = [];
  const lines = source.split("\n");
  let offset = 0;
  let fence: string | null = null;
  let open = 0;
  const out = lines.map((line) => {
    const start = offset;
    offset += line.length + 1;
    const marker = FENCE.exec(line)?.[1];
    if (marker && (!fence || marker.startsWith(fence))) {
      fence = fence ? null : marker;
      return line;
    }
    if (fence) return line;
    const name = COMARK_OPEN.exec(line)?.[1];
    if (name && isFigure(name)) open += 1;
    else if (open > 0 && COMARK_CLOSE.test(line)) {
      open -= 1;
      closers.push(start);
      return " ".repeat(line.length);
    }
    return line;
  });
  return { masked: out.join("\n"), closers };
}

export function isFigure(name: string): boolean {
  return FIGURES.has(name.replace(/^graph-/, ""));
}

/**
 * Turns the directives evergarden knows into elements for the renderer, and every other one back
 * into the text it was written as, so "10:30" and "a:b" stay text.
 */
export function remarkEvergardenDirectives(closers: number[], source: string) {
  return (tree: Root, _file: VFile) => {
    wrapComarkBlocks(tree, closers);

    // Directives change in place into what they render as, so their parents need no rewriting.
    visit(tree, (node) => {
      if (node.type === "textDirective") textDirective(node, source);
      else if (node.type === "leafDirective") Object.assign(node, asParagraph(node, source));
      else if (node.type === "containerDirective") containerDirective(node);
    });
  };
}

/** A Comark opening line followed by its body, up to the masked closer, becomes one container. */
function wrapComarkBlocks(tree: Root, closers: number[]) {
  visit(tree, (node) => {
    if (!("children" in node)) return;
    const children = node.children as RootContent[];
    for (let i = 0; i < children.length; i++) {
      const open = children[i];
      if (open?.type !== "leafDirective" || !isFigure(open.name)) continue;
      const from = open.position?.end.offset ?? 0;
      const close = closers.find((at) => at >= from);
      if (close === undefined) continue;
      let end = i + 1;
      while (end < children.length && (children[end]?.position?.end.offset ?? 0) <= close) end++;
      const container: ContainerDirective = {
        type: "containerDirective",
        name: open.name,
        attributes: open.attributes,
        children: children.slice(i + 1, end).filter(isFlow),
        position: open.position && {
          start: open.position.start,
          end: { line: 0, column: 0, offset: close + 2 },
        },
      };
      children.splice(i, end - i, container as RootContent);
    }
  });
}

function textDirective(node: TextDirective, source: string) {
  const name = node.name === "icon" ? labelOf(node) : "";
  if (!ICON_NAMES.has(name)) {
    Object.assign(node, written(node, source));
    return;
  }
  node.children = [];
  node.data = { hName: "span", hProperties: { dataIcon: name } };
}

function containerDirective(node: ContainerDirective) {
  // A tab was made by its tabs block, which is visited first.
  if (node.name === "tab" && node.data) return;
  const name = node.name.replace(/^graph-/, "");
  const title = node.attributes?.title ?? labelText(node);
  const body = node.children.filter((child) => !isLabel(child));

  if (FIGURES.has(name)) {
    node.children = body;
    node.data = {
      hName: "div",
      hProperties: { dataBlock: name, ...(title ? { dataTitle: title } : {}) },
    };
  } else if (name === "tabs") {
    node.children = splitTabs(body);
    node.data = { hName: "div", hProperties: { dataBlock: "tabs" } };
  } else if (name === "details") {
    const summary: Paragraph = {
      type: "paragraph",
      children: [{ type: "text", value: title || "Details" }],
      data: { hName: "summary" },
    };
    node.children = [summary, ...body];
    node.data = { hName: "details" };
  } else {
    // An unknown container keeps its body, without the lines that opened and closed it.
    node.children = body;
    node.data = { hName: "div" };
  }
}

/** `::tab[label]` lines divide a tabs block; each starts a tab holding what follows it. */
function splitTabs(children: ContainerDirective["children"]): ContainerDirective["children"] {
  const tabs: ContainerDirective[] = [];
  for (const child of children) {
    if (child.type === "leafDirective" && child.name === "tab") {
      tabs.push({
        type: "containerDirective",
        name: "tab",
        children: [],
        position: child.position,
        data: {
          hName: "div",
          hProperties: { dataTab: labelOf(child) || `Tab ${tabs.length + 1}` },
        },
      });
    } else {
      tabs.at(-1)?.children.push(child);
    }
  }
  return tabs;
}

function isFlow(node: RootContent): node is ContainerDirective["children"][number] {
  return !PHRASING.has(node.type);
}

const PHRASING = new Set(["text", "emphasis", "strong", "inlineCode", "link", "image", "break"]);

function labelOf(node: TextDirective | LeafDirective): string {
  return node.children
    .map((child) => ("value" in child ? child.value : ""))
    .join("")
    .trim();
}

function isLabel(node: RootContent): boolean {
  return node.type === "paragraph" && node.data?.directiveLabel === true;
}

function labelText(node: ContainerDirective): string {
  const label = node.children.find(isLabel);
  if (label?.type !== "paragraph") return "";
  return label.children.map((child) => ("value" in child ? child.value : "")).join("");
}

function written(node: TextDirective | LeafDirective, source: string): Text {
  const start = node.position?.start.offset ?? 0;
  const end = node.position?.end.offset ?? start;
  return { type: "text", value: source.slice(start, end), position: node.position };
}

function asParagraph(node: LeafDirective, source: string): Paragraph {
  return { type: "paragraph", children: [written(node, source)], position: node.position };
}
