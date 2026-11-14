import { useEffect, useState } from "react";

import { CloseIcon } from "#/components/ui/icons";
import { useModal } from "#/components/ui/modal";
import { PanZoom } from "#/components/ui/pan-zoom";

type Drawing = { svg: string; width: number; height: number };

export function DiagramViewer({
  source,
  open,
  onClose,
}: {
  source: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useModal(open);
  const [drawing, setDrawing] = useState<Drawing | null>(null);

  useEffect(() => {
    if (!open || drawing) return;
    void import("pele/lazy").then(async ({ renderAsync }) => {
      const { svg, width, height } = await renderAsync(source, {
        fontFamily: getComputedStyle(document.body).fontFamily,
        idPrefix: "viewer",
        // Drawn for the screen: a wide flowchart turns vertical on a phone, as it does in the page.
        maxWidth: window.innerWidth,
        autoDirection: true,
      });
      setDrawing({ svg, width, height });
    });
  }, [open, drawing, source]);

  return (
    <dialog ref={dialog} className="viewer" aria-label="Diagram" onClose={onClose}>
      {open ? (
        <>
          <div className="viewer-bar">
            <p className="viewer-hint">Scroll or drag to move. Pinch or hold ⌘ to zoom.</p>
            <button type="button" className="quiet-button" onClick={onClose}>
              <CloseIcon />
              Close
            </button>
          </div>
          {drawing ? (
            <PanZoom width={drawing.width} height={drawing.height} label="Diagram">
              {/* Pele escapes every label and filters links and styles, so its SVG is safe to insert. */}
              <div className="diagram" dangerouslySetInnerHTML={{ __html: drawing.svg }} />
            </PanZoom>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}
