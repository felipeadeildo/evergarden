import { useState } from "react";

import { CheckIcon, CopyIcon, DownloadIcon, PrintIcon } from "#/components/ui/icons";

/** Takes a document out of evergarden: its markdown, copied or as a file, or printed to PDF. */
export function ExportTools({ title, source }: { title: string; source: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([source], { type: "text/markdown;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: fileName(title) }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="export-tools">
      <button type="button" title="Copy the markdown" onClick={() => void copy()}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </button>
      <button type="button" title="Download the markdown" onClick={download}>
        <DownloadIcon />
        .md
      </button>
      <button type="button" title="Print or save as PDF" onClick={() => window.print()}>
        <PrintIcon />
        PDF
      </button>
    </div>
  );
}

function fileName(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "document"}.md`;
}
