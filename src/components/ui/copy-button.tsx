import { useState } from "react";

import { CheckIcon, CopyIcon } from "#/components/ui/icons";

/** With `iconOnly` the size never changes, so nothing around it moves. */
export function CopyButton({
  text,
  label = "Copy",
  className = "quiet-button",
  iconOnly = false,
}: {
  text: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      className={iconOnly ? `${className} icon-button` : className}
      onClick={() => void copy()}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span aria-live="polite" className={iconOnly ? "sr-only" : undefined}>
        {caption(copied, iconOnly, label)}
      </span>
    </button>
  );
}

function caption(copied: boolean, iconOnly: boolean, label: string): string {
  if (copied) return "Copied";
  return iconOnly ? "" : label;
}
