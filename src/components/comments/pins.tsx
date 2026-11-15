import { useLayoutEffect, useRef } from "react";

import { DRAFT, useComments } from "./comments";
import { pinAt } from "./places";

/**
 * A numbered pin on each spot a comment points at in a figure, over the document's text. Pins
 * follow the figures as they redraw or the page reflows, so positions go straight to the styles.
 */
export function CommentPins() {
  const { shown, places, active, setActive, setHovered, draft } = useComments();
  const layer = useRef<HTMLDivElement>(null);
  const points = shown.filter((thread) => thread.anchor.kind === "point");
  const ids = [...points.map((thread) => thread.id), ...(draft?.kind === "point" ? [DRAFT] : [])];
  const key = ids.join();

  useLayoutEffect(() => {
    const element = layer.current;
    if (!element || !key) return undefined;
    function place() {
      const origin = element!.getBoundingClientRect();
      const found = places();
      for (const pin of element!.querySelectorAll<HTMLElement>("[data-pin]")) {
        const spot = found.get(pin.dataset.pin ?? "");
        if (spot?.kind !== "point") {
          pin.hidden = true;
          continue;
        }
        const at = pinAt(spot);
        pin.hidden = false;
        pin.style.left = `${at.x - origin.left}px`;
        pin.style.top = `${at.y - origin.top}px`;
      }
    }
    place();
    const observer = new ResizeObserver(place);
    if (element.parentElement) observer.observe(element.parentElement);
    return () => observer.disconnect();
  }, [key, places]);

  if (ids.length === 0) return null;
  return (
    <div ref={layer} className="comment-pins">
      {points.map((thread, index) => (
        <button
          key={thread.id}
          type="button"
          data-pin={thread.id}
          className="comment-pin"
          data-active={thread.id === active || undefined}
          aria-label={`Comment ${index + 1}: ${thread.body}`}
          onClick={() => setActive(thread.id)}
          onPointerEnter={() => setHovered(thread.id)}
          onPointerLeave={() => setHovered(null)}
        >
          {index + 1}
        </button>
      ))}
      {draft?.kind === "point" ? (
        <span data-pin={DRAFT} className="comment-pin" data-active aria-hidden>
          +
        </span>
      ) : null}
    </div>
  );
}
