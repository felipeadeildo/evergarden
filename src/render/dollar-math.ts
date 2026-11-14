import type { Root, Text } from "mdast";
import type { InlineMath } from "mdast-util-math";
import { SKIP, visit } from "unist-util-visit";

const WHITESPACE = /\s/;
const DIGIT = /\d/;

/**
 * Reads `$x$` as inline math with Pandoc's rule: the opening `$` has a non-space character on its
 * right, the closing `$` has a non-space character on its left and no digit on its right. Prices
 * stay text: in "$5 and $10" the second `$` follows a space, so it cannot close.
 */
export function remarkDollarMath() {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || index === undefined) return undefined;
      const parts = split(node.value);
      if (parts.length === 1) return undefined;
      parent.children.splice(index, 1, ...parts);
      return [SKIP, index + parts.length];
    });
  };
}

function split(value: string): Array<Text | InlineMath> {
  const parts: Array<Text | InlineMath> = [];
  let rest = 0;
  for (let open = value.indexOf("$"); open !== -1; open = value.indexOf("$", open + 1)) {
    if (!opens(value, open)) continue;
    const close = closing(value, open + 1);
    if (close === -1) continue;
    if (open > rest) parts.push({ type: "text", value: value.slice(rest, open) });
    parts.push(inlineMath(value.slice(open + 1, close)));
    rest = close + 1;
    open = close;
  }
  if (rest === 0) return [{ type: "text", value }];
  if (rest < value.length) parts.push({ type: "text", value: value.slice(rest) });
  return parts;
}

function opens(value: string, at: number): boolean {
  const next = value[at + 1];
  return next !== undefined && next !== "$" && !WHITESPACE.test(next) && value[at - 1] !== "$";
}

function closing(value: string, from: number): number {
  for (let at = value.indexOf("$", from); at !== -1; at = value.indexOf("$", at + 1)) {
    const before = value[at - 1] ?? " ";
    const after = value[at + 1] ?? "";
    if (!WHITESPACE.test(before) && !DIGIT.test(after) && after !== "$") return at;
  }
  return -1;
}

/** The same node remark-math builds for `$$x$$`, so KaTeX and the sanitiser treat both alike. */
function inlineMath(value: string): InlineMath {
  return {
    type: "inlineMath",
    value,
    data: {
      hName: "code",
      hProperties: { className: ["language-math", "math-inline"] },
      hChildren: [{ type: "text", value }],
    },
  };
}
