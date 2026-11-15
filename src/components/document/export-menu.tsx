import { useId, useRef, useState } from "react";

import { CheckIcon, CopyIcon, DownloadIcon, MoreIcon, PrintIcon } from "#/components/ui/icons";

/** Takes a document out of evergarden: its markdown, copied or as a file, or printed to PDF. */
export function ExportMenu({ title, source }: { title: string; source: string }) {
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      menu.current?.hidePopover();
    }, 900);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([source], { type: "text/markdown;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: fileName(title),
    });
    link.click();
    URL.revokeObjectURL(url);
    menu.current?.hidePopover();
  }

  function print() {
    menu.current?.hidePopover();
    window.print();
  }

  return (
    <>
      <button
        type="button"
        className="quiet-button icon-button"
        popoverTarget={menuId}
        aria-label="Export"
      >
        <MoreIcon />
      </button>
      <div id={menuId} ref={menu} popover="auto" className="popover menu export-menu">
        <button type="button" className="menu-item" onClick={() => void copy()}>
          {copied ? <CheckIcon className="menu-icon" /> : <CopyIcon className="menu-icon" />}
          <span className="menu-label">{copied ? "Copied" : "Copy markdown"}</span>
        </button>
        <button type="button" className="menu-item" onClick={download}>
          <DownloadIcon className="menu-icon" />
          <span className="menu-label">Download .md</span>
        </button>
        <button type="button" className="menu-item" onClick={print}>
          <PrintIcon className="menu-icon" />
          <span className="menu-label">Print or save as PDF</span>
        </button>
      </div>
    </>
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
