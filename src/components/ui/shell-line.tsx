import { createHighlighter } from "@tanstack/highlight/core";
import { shell } from "@tanstack/highlight/languages";
import type { ReactNode } from "react";

// Only the shell grammar, so the browser bundle stays small; documents highlight on the server.
const highlighter = createHighlighter({ languages: [shell] });
// The grammar leaves flags as plain text. Splitting on this capture puts every flag at an odd
// index, so it can be muted and the values between flags stand out.
const FLAG = /(?<=^|\s)(--?[a-z][\w-]*)/;

/** One line of shell, coloured with the same `th-*` classes as code in documents. */
export function ShellLine({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  function add(value: string, className?: string) {
    if (!value) return;
    parts.push(
      className ? (
        <span key={parts.length} className={`th-token th-${className}`}>
          {value}
        </span>
      ) : (
        value
      ),
    );
  }

  for (const token of highlighter.tokenize(text, { lang: "shell" }).tokens) {
    if (token.className) add(token.value, token.className);
    else
      token.value.split(FLAG).forEach((piece, index) => add(piece, index % 2 ? "meta" : undefined));
  }
  return <span>{parts}</span>;
}
