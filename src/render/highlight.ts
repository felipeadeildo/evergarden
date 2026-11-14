import { createCssVariablesTheme, createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Colours come from `--shiki-*` variables in styles.css, so code follows the light and dark palettes.
export const theme = createCssVariablesTheme({ name: "evergarden", variablePrefix: "--shiki-" });

let highlighter: Promise<HighlighterCore> | undefined;

/** One highlighter per isolate, with a fixed set of languages: Workers cannot load grammars on demand. */
export function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [theme],
    langs: [
      import("shiki/langs/bash.mjs"),
      import("shiki/langs/css.mjs"),
      import("shiki/langs/diff.mjs"),
      import("shiki/langs/go.mjs"),
      import("shiki/langs/html.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/jsx.mjs"),
      import("shiki/langs/markdown.mjs"),
      import("shiki/langs/python.mjs"),
      import("shiki/langs/rust.mjs"),
      import("shiki/langs/sql.mjs"),
      import("shiki/langs/toml.mjs"),
      import("shiki/langs/tsx.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/yaml.mjs"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}
