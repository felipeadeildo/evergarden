import type { Element } from "hast";
import { toHtml } from "hast-util-to-html";
import { toString } from "hast-util-to-string";
import { useEffect, useRef } from "react";

import { stringProperty } from "#/lib/hast";

/**
 * A diagram the server already drew. In the browser Pele draws it again at the real width and
 * with the real fonts, which can turn a wide flowchart vertical on a phone and adds pinch zoom.
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

  useEffect(() => {
    const element = container.current;
    if (!element || error) return undefined;
    let destroyed = false;
    let mounted: { destroy: () => void } | undefined;
    void import("pele/lazy").then(async ({ mountAsync }) => {
      if (destroyed) return;
      mounted = await mountAsync(element, text, { zoom: "auto" });
      if (destroyed) mounted.destroy();
    });
    return () => {
      destroyed = true;
      mounted?.destroy();
    };
  }, [text, error]);

  return (
    <figure data-kind="diagram" data-sourcepos={stringProperty(node, "dataSourcepos")}>
      {error ? (
        <>
          <pre className="diagram-source">{text}</pre>
          <figcaption className="diagram-error">
            This diagram could not be drawn: {error}
          </figcaption>
        </>
      ) : (
        <div
          ref={container}
          className="diagram"
          // Pele owns this element after the first render; React never updates its children.
          dangerouslySetInnerHTML={{ __html: drawing ? toHtml(drawing.children) : "" }}
        />
      )}
    </figure>
  );
}
