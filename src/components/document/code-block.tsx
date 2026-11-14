import type { Element } from "hast";
import { toString } from "hast-util-to-string";
import type { ReactNode } from "react";

import { CopyButton } from "#/components/ui/copy-button";
import { stringProperty } from "#/lib/hast";

export function CodeBlock({ node, children }: { node: Element; children: ReactNode }) {
  const language = stringProperty(node, "dataLanguage");
  return (
    <figure data-kind="code" data-sourcepos={stringProperty(node, "dataSourcepos")}>
      <div className="code-bar">
        {language && language !== "text" ? <span className="code-language">{language}</span> : null}
        <CopyButton text={toString(node).replace(/\n$/, "")} className="code-copy" />
      </div>
      {children}
    </figure>
  );
}
