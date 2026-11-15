import {
  defineLanguage,
  type HighlightTokenClass,
  type TokenRange,
} from "@tanstack/highlight/core";

const KEYWORDS = new Set([
  "and",
  "or",
  "unless",
  "by",
  "without",
  "on",
  "ignoring",
  "group_left",
  "group_right",
  "offset",
  "bool",
  "atan2",
]);

const AGGREGATIONS = new Set([
  "sum",
  "min",
  "max",
  "avg",
  "group",
  "stddev",
  "stdvar",
  "count",
  "count_values",
  "bottomk",
  "topk",
  "quantile",
  "limitk",
  "limit_ratio",
]);

// One alternative per token kind, tried in order at each position.
const TOKEN =
  /(#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`[^`]*`)|(\[[0-9a-zA-Z:.]+\])|(\d+(?:\.\d+)?(?:e[+-]?\d+)?(?:ms|[smhdwy])?\b|0x[0-9a-f]+\b|\bInf\b|\bNaN\b)|([a-zA-Z_:][\w:]*)(\s*\()?|(=~|!~|!=|==|<=|>=|[-+*/%^<>=])/gi;

/** PromQL, as written in Prometheus, Mimir and Grafana alerts. */
export const promql = defineLanguage({
  name: "promql",
  aliases: ["prometheus", "metricsql"],
  tokenize(code) {
    const ranges: TokenRange[] = [];
    const push = (start: number, length: number, className: HighlightTokenClass) =>
      ranges.push({ start, end: start + length, className });
    // Words between { and } are label names, not metrics.
    let labels = false;
    let scanned = 0;
    for (const match of code.matchAll(TOKEN)) {
      const start = match.index;
      for (; scanned < start; scanned++) {
        if (code[scanned] === "{") labels = true;
        else if (code[scanned] === "}") labels = false;
      }
      scanned = start + match[0].length;
      const [whole, comment, string, range, number, word, call, operator] = match;
      if (comment) push(start, whole.length, "comment");
      else if (string) push(start, whole.length, "string");
      else if (range || number) push(start, whole.length, "number");
      else if (operator) push(start, whole.length, "operator");
      else if (word && labels) push(start, word.length, "property");
      else if (word && KEYWORDS.has(word.toLowerCase())) push(start, word.length, "keyword");
      else if (word && (call || AGGREGATIONS.has(word))) push(start, word.length, "function");
      else if (word) push(start, word.length, "variable");
    }
    return ranges;
  },
});
