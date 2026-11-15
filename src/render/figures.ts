import type { Element, ElementContent, Properties } from "hast";
import { toString } from "hast-util-to-string";

/**
 * Draws a figure from the markdown inside `::name … ::`, after mdxcn's grammar: `**bold**` is the
 * row to read, `*italic*` recedes, `label: value` is one row, ` — ` starts a note, `a → b` a path.
 */
export function figureFrom(
  block: Element,
  name: string,
  offsets: (node: Element) => string | undefined,
): Element {
  const title = typeof block.properties.dataTitle === "string" ? block.properties.dataTitle : "";
  const draw = DRAW[name] ?? ((children) => children);
  return el("figure", { dataKind: "block", dataBlock: name, dataSourcepos: offsets(block) }, [
    ...(title ? [el("figcaption", { className: ["block-title"] }, [text(title)])] : []),
    ...draw(block.children.filter(isElement), offsets),
  ]);
}

type Draw = (children: Element[], offsets: (node: Element) => string | undefined) => Element[];

const DRAW: Record<string, Draw> = {
  timeline: (children, offsets) => [
    el(
      "ol",
      { className: ["timeline"] },
      items(children).map((li) => {
        const { tone, nodes } = toneOf(inline(li));
        const [when, what] = split(nodes, ": ") ?? [[], nodes];
        const state = tone === "accent" ? "now" : tone === "muted" ? "next" : "done";
        return el("li", { dataState: state, dataSourcepos: offsets(li) }, [
          el("span", { className: ["timeline-when"] }, when),
          el("span", { className: ["timeline-what"] }, noted(what)),
        ]);
      }),
    ),
  ],

  steps: (children) => children.map((node) => withClass(node, "steps")),

  check: (children) =>
    children.map((node) => {
      for (const li of items([node])) li.children = noted(li.children);
      return withClass(node, "check");
    }),

  decision: (children, offsets) =>
    children.map((node) =>
      isList(node)
        ? el(
            "ul",
            { className: ["decision"] },
            items([node]).map((li) => {
              const { tone, nodes } = itemRow(inline(li));
              const state = tone === "accent" ? "chosen" : tone === "muted" ? "rejected" : "open";
              return el("li", { dataState: state, dataSourcepos: offsets(li) }, nodes);
            }),
          )
        : withClass(node, "block-note"),
    ),

  tree: (children, offsets) => children.filter(isList).map((list) => treeList(list, offsets)),

  stat: (children, offsets) => [
    el(
      "dl",
      { className: ["stat"] },
      items(children).map((li) => {
        const nodes = inline(li);
        const [value, label] = leadingValue(nodes);
        return el("div", { dataSourcepos: offsets(li) }, [
          el("dt", { className: ["stat-label"] }, noted(label)),
          el("dd", { className: ["stat-value"] }, value),
        ]);
      }),
    ),
  ],

  spec: (children, offsets) => [
    el(
      "dl",
      { className: ["spec"] },
      items(children).map((li) => {
        const { tone, nodes } = toneOf(inline(li));
        const [label, value] = split(nodes, ": ") ?? [nodes, []];
        return el("div", { dataTone: tone, dataSourcepos: offsets(li) }, [
          el("dt", {}, label),
          el("dd", {}, noted(value)),
        ]);
      }),
    ),
  ],

  flow: (children, offsets) =>
    children.flatMap((paragraph) =>
      lines(paragraph.children).map((line) =>
        el(
          "ol",
          { className: ["flow"], dataSourcepos: offsets(paragraph) },
          splitAll(line, /\s*(?:→|->)\s*/).map((step) => {
            const { tone, nodes } = toneOf(step);
            return el("li", { dataTone: tone }, nodes);
          }),
        ),
      ),
    ),

  board: (children, offsets) => [
    el(
      "div",
      { className: ["board"] },
      sections(children).map(({ heading, body }) => {
        const list = body.find(isList);
        const count = list ? items([list]).length : 0;
        return el("section", { dataSourcepos: offsets(heading) }, [
          el("p", { className: ["board-title"] }, [
            ...heading.children,
            el("span", { className: ["board-count"] }, [text(String(count))]),
          ]),
          ...(list
            ? [
                el(
                  "ul",
                  {},
                  items([list]).map((li) => {
                    const { tone, nodes } = itemRow(inline(li));
                    return el("li", { dataTone: tone, dataSourcepos: offsets(li) }, nodes);
                  }),
                ),
              ]
            : []),
        ]);
      }),
    ),
  ],

  faq: (children, offsets) => [
    el(
      "dl",
      { className: ["faq"] },
      sections(children).map(({ heading, body }) =>
        el("div", { dataSourcepos: offsets(heading) }, [
          el("dt", {}, heading.children),
          el("dd", {}, body),
        ]),
      ),
    ),
  ],

  keys: (children, offsets) => [
    el(
      "dl",
      { className: ["keys"] },
      items(children).map((li) => {
        const { tone, nodes } = toneOf(inline(li));
        const [combo, action] = split(nodes, ": ") ?? [nodes, []];
        return el("div", { dataTone: tone, dataSourcepos: offsets(li) }, [
          el("dt", {}, keyCaps(toString(el("span", {}, combo)))),
          el("dd", {}, noted(action)),
        ]);
      }),
    ),
  ],

  rank: (children, offsets) => {
    const rows = items(children).map((li) => {
      const toned = toneOf(inline(li));
      const [value, label] = leadingValue(toned.nodes);
      const bold = value.length === 1 && isElement(value[0]!) && value[0].tagName === "strong";
      const tone = bold ? "accent" : toned.tone;
      return { li, tone, value, label, size: numberIn(toString(el("span", {}, value))) };
    });
    const largest = Math.max(...rows.map((row) => row.size), 0) || 1;
    return [
      el(
        "ol",
        { className: ["rank"] },
        rows.map((row) =>
          el(
            "li",
            {
              dataTone: row.tone,
              dataSourcepos: offsets(row.li),
              style: `--share: ${(row.size / largest).toFixed(3)}`,
            },
            [
              el("span", { className: ["rank-label"] }, noted(row.label)),
              el("span", { className: ["rank-value"] }, row.value),
              el("span", { className: ["rank-bar"] }, []),
            ],
          ),
        ),
      ),
    ];
  },

  meter: (children, offsets) =>
    children.map((paragraph) => {
      const [value, note] = split(paragraph.children, " — ") ?? [paragraph.children, []];
      const share = Math.min(Math.max(numberIn(toString(el("span", {}, value))) / 100, 0), 1);
      return el(
        "div",
        { className: ["meter"], dataSourcepos: offsets(paragraph), style: `--share: ${share}` },
        [
          el("span", { className: ["meter-value"] }, value),
          el("span", { className: ["meter-bar"] }, []),
          ...(note.length ? [el("span", { className: ["block-note"] }, note)] : []),
        ],
      );
    }),
};

function treeList(list: Element, offsets: (node: Element) => string | undefined): Element {
  return el(
    "ul",
    { className: ["tree"] },
    items([list]).map((li) => {
      const { tone, nodes } = itemRow(inline(li));
      const nested = li.children.filter(isElement).filter(isList);
      return el("li", { dataTone: tone, dataSourcepos: offsets(li) }, [
        el("span", { className: ["tree-label"] }, nodes),
        ...nested.map((child) => treeList(child, offsets)),
      ]);
    }),
  );
}

/** `### heading` then its content, as in a board's columns or a list of questions. */
function sections(children: Element[]) {
  const out: Array<{ heading: Element; body: Element[] }> = [];
  for (const node of children) {
    if (/^h[2-6]$/.test(node.tagName)) out.push({ heading: node, body: [] });
    else out.at(-1)?.body.push(node);
  }
  return out;
}

function items(children: Element[]): Element[] {
  const list = children.find(isList);
  return list ? list.children.filter(isElement).filter((node) => node.tagName === "li") : [];
}

/** A list item's own text: its first paragraph in a loose list, without nested lists. */
function inline(li: Element): ElementContent[] {
  const paragraph = li.children.find((node) => isElement(node) && node.tagName === "p");
  const nodes = paragraph && isElement(paragraph) ? paragraph.children : li.children;
  return trim(nodes.filter((node) => !(isElement(node) && isList(node))));
}

/** An item written wholly in bold is the accent; wholly in italics, it recedes. */
function toneOf(nodes: ElementContent[]): {
  tone: "accent" | "muted" | undefined;
  nodes: ElementContent[];
} {
  const content = trim(nodes);
  const only = content.length === 1 ? content[0] : undefined;
  if (only && isElement(only) && only.tagName === "strong") {
    return { tone: "accent", nodes: only.children };
  }
  if (only && isElement(only) && only.tagName === "em")
    return { tone: "muted", nodes: only.children };
  return { tone: undefined, nodes: content };
}

/** An item and its note, toned by the part before the note: `**Postgres** — we run it`. */
function itemRow(nodes: ElementContent[]) {
  const [main, note] = split(nodes, " — ") ?? [nodes, []];
  const toned = toneOf(main);
  const tail = note.length ? [el("span", { className: ["block-note"] }, note)] : [];
  return { tone: toned.tone, nodes: [...toned.nodes, ...tail] };
}

/** The text after ` — ` is a note: muted, after the item. */
function noted(nodes: ElementContent[]): ElementContent[] {
  const parts = split(nodes, " — ");
  if (!parts) return nodes;
  return [...parts[0], el("span", { className: ["block-note"] }, parts[1])];
}

/** Splits at the first `separator` in the item's own text, outside any formatting. */
function split(
  nodes: ElementContent[],
  separator: string,
): [ElementContent[], ElementContent[]] | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node?.type !== "text") continue;
    const at = node.value.indexOf(separator);
    if (at === -1) continue;
    const before = node.value.slice(0, at);
    const after = node.value.slice(at + separator.length);
    return [trim([...nodes.slice(0, i), text(before)]), trim([text(after), ...nodes.slice(i + 1)])];
  }
  return null;
}

function splitAll(nodes: ElementContent[], separator: RegExp): ElementContent[][] {
  const parts: ElementContent[][] = [[]];
  for (const node of nodes) {
    if (node.type !== "text") {
      parts.at(-1)!.push(node);
      continue;
    }
    const pieces = node.value.split(separator);
    pieces.forEach((piece, index) => {
      if (index > 0) parts.push([]);
      if (piece) parts.at(-1)!.push(text(piece));
    });
  }
  return parts.map(trim).filter((part) => part.length > 0);
}

/** A paragraph's lines, split at its soft line breaks. */
function lines(nodes: ElementContent[]): ElementContent[][] {
  return splitAll(nodes, /\n/);
}

/** `**860** shipped` or `12,400 /docs`: the figure first, then what it counts. */
// Units that belong to the number before them: "16,5 h", "800 ms", "14.7 TB", "7,51 mil".
const UNIT = String.raw`(?:%|pp|x|×|ms|s|min|h|d|dias?|days?|mo|y|k|M|bi|mi|mil|[KMGTP]i?B|[kMG]bps)`;
const LEADING_VALUE = new RegExp(String.raw`^(\S+(?:\s+${UNIT}(?=\s|$))?)\s*(.*)$`, "s");

function leadingValue(nodes: ElementContent[]): [ElementContent[], ElementContent[]] {
  const [first, ...rest] = trim(nodes);
  if (!first) return [[], []];
  if (isElement(first) && first.tagName === "strong") return [[first], trim(rest)];
  if (first.type === "text") {
    const match = LEADING_VALUE.exec(first.value);
    if (match) return [[text(match[1] ?? "")], trim([text(match[2] ?? ""), ...rest])];
  }
  return [[first], trim(rest)];
}

const SCALE: Record<string, number> = { k: 1e3, mil: 1e3, M: 1e6, mi: 1e6, B: 1e9, bi: 1e9 };

/**
 * The number in "12,400", "1.279.942", "7,51 mil" or "1.30M", in either convention. A separator
 * is the decimal point unless it repeats, or the other separator comes after it, or exactly three
 * digits follow it in a number that does not start with 0.
 */
export function numberIn(value: string): number {
  const match = /(-?\d[\d.,]*)\s*(?:(mil|mi|bi|[kMB])(?!\p{L}))?/u.exec(value);
  if (!match) return 0;
  const digits = (match[1] ?? "").replace(/[.,]+$/, "");
  const last = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
  const before = digits.slice(0, last);
  const fraction = digits.slice(last + 1);
  const isDecimal =
    last !== -1 &&
    (/[.,]/.test(before)
      ? !before.includes(digits.charAt(last))
      : fraction.length !== 3 || /^-?0$/.test(before));
  const whole = (isDecimal ? before : digits).replace(/[.,]/g, "");
  const number = Number(isDecimal ? `${whole}.${fraction}` : whole) || 0;
  return number * (SCALE[match[2] ?? ""] ?? 1);
}

/** `⌘K`, `Ctrl+Shift+P` or `g then d`, as keys. */
function keyCaps(combo: string): ElementContent[] {
  return combo.split(/(\s+then\s+)/).flatMap((part) => {
    if (/^\s+then\s+$/.test(part)) return [text(" then ")];
    return part
      .split("+")
      .flatMap((key) => key.trim().split(/(?<=[⌘⌥⇧⌃])/))
      .filter(Boolean)
      .map((key) => el("kbd", {}, [text(key)]));
  });
}

function trim(nodes: ElementContent[]): ElementContent[] {
  const out = [...nodes];
  const first = out[0];
  if (first?.type === "text") out[0] = text(first.value.trimStart());
  const last = out.at(-1);
  if (last?.type === "text") out[out.length - 1] = text(last.value.trimEnd());
  return out.filter((node) => !(node.type === "text" && node.value === ""));
}

function withClass(node: Element, name: string): Element {
  const className = Array.isArray(node.properties.className) ? node.properties.className : [];
  return { ...node, properties: { ...node.properties, className: [...className, name] } };
}

function isList(node: Element): boolean {
  return node.tagName === "ul" || node.tagName === "ol";
}

function isElement(node: ElementContent): node is Element {
  return node.type === "element";
}

function el(tagName: string, properties: Properties, children: ElementContent[]): Element {
  return { type: "element", tagName, properties, children };
}

function text(value: string): ElementContent {
  return { type: "text", value };
}
