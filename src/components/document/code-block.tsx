import type { Element } from "hast";
import { toString } from "hast-util-to-string";
import { type ReactNode, useState } from "react";

import { CheckIcon, CopyIcon } from "#/components/ui/icons";
import { stringProperty } from "#/lib/hast";

export function CodeBlock({ node, children }: { node: Element; children: ReactNode }) {
  const language = stringProperty(node, "dataLanguage");
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(toString(node).replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <figure data-kind="code" data-sourcepos={stringProperty(node, "dataSourcepos")}>
      <div className="code-bar">
        {language && language !== "text" ? <span className="code-language">{language}</span> : null}
        <button type="button" className="code-copy" onClick={() => void copy()}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      {children}
    </figure>
  );
}
