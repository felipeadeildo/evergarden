import type { Element } from "hast";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type KeyboardEvent,
  useId,
  useRef,
  useState,
} from "react";

import { stringProperty } from "#/lib/hast";

/** `:::tabs` with `::tab[label]` lines: one panel at a time, the first shown before scripts run. */
export function Tabs({ node, children, ...props }: ComponentProps<"figure"> & { node: Element }) {
  const id = useId();
  const [shown, setShown] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const labels = node.children.flatMap((child) =>
    child.type === "element" ? [stringProperty(child, "dataTab") ?? ""] : [],
  );
  const panels = Children.toArray(children).filter(isValidElement);

  function onKeyDown(event: KeyboardEvent) {
    const last = labels.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: shown === last ? 0 : shown + 1,
      ArrowLeft: shown === 0 ? last : shown - 1,
      Home: 0,
      End: last,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setShown(next);
    list.current?.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
  }

  return (
    <figure {...props} className="tabs">
      <div role="tablist" ref={list}>
        {labels.map((label, index) => (
          <button
            key={label + String(index)}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === shown}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === shown ? 0 : -1}
            onClick={() => setShown(index)}
            onKeyDown={onKeyDown}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div
          key={panel.key}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={index !== shown}
        >
          {panel}
        </div>
      ))}
    </figure>
  );
}
