import { createHighlighter } from "@tanstack/highlight/core";
import { shell } from "@tanstack/highlight/languages";
import type { ReactNode } from "react";

// Only the shell grammar, so the browser bundle stays small; documents highlight on the server.
const highlighter = createHighlighter({ languages: [shell] });
// The grammar leaves flags as plain text; muting them makes the values between them stand out.
const FLAG = /(?<=^|\s)(--?[a-z][\w-]*)/;
const IS_FLAG = /^--?[a-z]/;

/** One line of shell, coloured with the same `th-*` classes as code in documents. */
export function ShellLine({ text }: { text: string }) {
  const { tokens } = highlighter.tokenize(text, { lang: "shell" });
  const parts: ReactNode[] = [];
  for (const token of tokens) {
    if (token.className) {
      parts.push(
        <span key={parts.length} className={`th-token th-${token.className}`}>
          {token.value}
        </span>,
      );
      continue;
    }
    for (const piece of token.value.split(FLAG)) {
      if (!piece) continue;
      parts.push(
        IS_FLAG.test(piece) ? (
          <span key={parts.length} className="th-token th-meta">
            {piece}
          </span>
        ) : (
          piece
        ),
      );
    }
  }
  return <span>{parts}</span>;
}
