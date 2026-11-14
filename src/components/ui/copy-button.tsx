import { useState } from "react";

import { CheckIcon, CopyIcon } from "#/components/ui/icons";

/**
 * Copies `text` and says so for a moment. With `iconOnly` it keeps one size while the icon turns
 * into a check, so nothing around it moves; the words still reach screen readers.
 */
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

/** What the button says: "Copied" for a moment, otherwise its label, which an icon button keeps for its aria-label. */
function caption(copied: boolean, iconOnly: boolean, label: string): string {
  if (copied) return "Copied";
  return iconOnly ? "" : label;
}
