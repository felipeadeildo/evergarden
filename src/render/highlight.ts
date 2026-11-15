import { createHighlighter } from "@tanstack/highlight/core";
import * as languages from "@tanstack/highlight/languages";

import { promql } from "./promql";

/** Synchronous and setup-free, which keeps rendering inside a Worker's CPU budget. */
export const highlighter = createHighlighter({
  languages: [...Object.values(languages), promql],
  fallbackLanguage: "text",
});
