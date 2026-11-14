import type { Element } from "hast";
import { toHtml } from "hast-util-to-html";
import { toString } from "hast-util-to-string";
import { useEffect, useRef, useState } from "react";

import { ExpandIcon } from "#/components/ui/icons";
import { stringProperty } from "#/lib/hast";

import { DiagramViewer } from "./diagram-viewer";

/**
 * A diagram the server already drew. In the browser Pele draws it again at the real width and
 * with the real fonts, which can turn a wide flowchart vertical on a phone. The page shows the
 * whole diagram; opening it shows it full screen, to move around and zoom into.
 */
export function Diagram({ node }: { node: Element }) {
  const drawing = node.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "div",
  );
  const source = node.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "pre",
  );
  const text = source ? toString(source) : "";
  const error = stringProperty(node, "dataError");
  const container = useRef<HTMLDivElement>(null);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element || error) return undefined;
    let destroyed = false;
    let mounted: { destroy: () => void } | undefined;
    void import("pele/lazy").then(async ({ mountAsync }) => {
      if (destroyed) return;
      mounted = await mountAsync(element, text, { zoom: false });
      if (destroyed) mounted.destroy();
    });
    return () => {
      destroyed = true;
      mounted?.destroy();
    };
  }, [text, error]);

  if (error) {
    return (
      <figure data-kind="diagram" data-sourcepos={stringProperty(node, "dataSourcepos")}>
        <pre className="diagram-source">{text}</pre>
        <figcaption className="diagram-error">This diagram could not be drawn: {error}</figcaption>
      </figure>
    );
  }

  return (
    <figure data-kind="diagram" data-sourcepos={stringProperty(node, "dataSourcepos")}>
      <button
        type="button"
        className="diagram-open"
        aria-label="Open the diagram full screen"
        onClick={() => setViewing(true)}
      >
        <div
          ref={container}
          className="diagram"
          // Pele owns this element after the first render; React never updates its children.
          dangerouslySetInnerHTML={{ __html: drawing ? toHtml(drawing.children) : "" }}
        />
        <span className="diagram-expand" aria-hidden>
          <ExpandIcon />
        </span>
      </button>
      <DiagramViewer source={text} open={viewing} onClose={() => setViewing(false)} />
    </figure>
  );
}
