import { createHighlighter } from "@tanstack/highlight/core";
import * as languages from "@tanstack/highlight/languages";

/**
 * Every language TanStack Highlight ships, about 80. Highlighting is synchronous and needs no
 * setup, which keeps rendering inside a Worker's CPU budget. Tokens are `th-*` classes coloured
 * by CSS variables in styles.css.
 */
export const highlighter = createHighlighter({
  languages: Object.values(languages),
  fallbackLanguage: "text",
});
