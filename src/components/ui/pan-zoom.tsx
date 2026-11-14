import {
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FitIcon, ZoomInIcon, ZoomOutIcon } from "#/components/ui/icons";

type View = { scale: number; x: number; y: number };
type Size = { width: number; height: number };
type Point = { x: number; y: number };

const MAX_SCALE = 4;
const MAX_FIT = 1.25;
const EDGE = 48;
const KEY_STEP = 80;

/**
 * Shows content of a known natural size in a viewport the person can move around:
 * two-finger scroll or drag to pan, pinch or Ctrl/⌘ + scroll to zoom at the pointer,
 * double-click to zoom in or back out, and + − 0 and the arrow keys once focused.
 * It starts with the whole content in view, and keeps part of it on screen at all times.
 *
 * Zooming resizes the content box instead of scaling it, so vector content is drawn again at
 * each size and stays sharp. The children must fill that box: an SVG with a viewBox and
 * width and height of 100% does.
 */
export function PanZoom({
  width,
  height,
  label,
  children,
}: {
  width: number;
  height: number;
  label: string;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const camera = useCamera(viewport, { width, height });

  return (
    <div className="pan-zoom">
      <div
        ref={viewport}
        className="pan-zoom-viewport"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it takes keys to pan and zoom
        tabIndex={0}
        role="application"
        aria-label={label}
        aria-roledescription="zoomable image"
      >
        {camera.view ? (
          <div
            className="pan-zoom-content"
            style={{
              width: width * camera.view.scale,
              height: height * camera.view.scale,
              transform: `translate(${camera.view.x}px, ${camera.view.y}px)`,
            }}
          >
            {children}
          </div>
        ) : null}
      </div>
      <div className="pan-zoom-controls" role="toolbar" aria-label="Zoom">
        <button type="button" onClick={() => camera.zoomAt(0.8)} aria-label="Zoom out">
          <ZoomOutIcon />
        </button>
        <output className="pan-zoom-scale" aria-live="polite">
          {camera.view ? `${Math.round(camera.view.scale * 100)}%` : ""}
        </output>
        <button type="button" onClick={() => camera.zoomAt(1.25)} aria-label="Zoom in">
          <ZoomInIcon />
        </button>
        <button type="button" onClick={camera.reset} aria-label="Fit to screen">
          <FitIcon />
        </button>
      </div>
    </div>
  );
}

type Moves = {
  zoomAt: (factor: number, point?: Point) => void;
  panBy: (dx: number, dy: number) => void;
  reset: () => void;
  /** Zooms in at the point, or back to the whole content when already zoomed in. */
  toggle: (point: Point) => void;
};

/** The moves available on content of a size, in a viewport of a size. */
function movesFor(
  setView: Dispatch<SetStateAction<View | null>>,
  room: Size | null,
  size: Size,
): Moves {
  function update(change: (current: View, viewport: Size) => View) {
    if (room) setView((current) => (current ? change(current, room) : current));
  }
  return {
    zoomAt: (factor, point) =>
      update((current, viewport) =>
        zoom(current, factor, point ?? center(viewport), size, viewport),
      ),
    panBy: (dx, dy) =>
      update((current, viewport) =>
        clamp({ ...current, x: current.x + dx, y: current.y + dy }, size, viewport),
      ),
    reset: () => update((_, viewport) => fitView(size, viewport)),
    toggle: (point) =>
      update((current, viewport) => {
        const fit = fitView(size, viewport);
        return current.scale > fit.scale * 1.5 ? fit : zoom(current, 2, point, size, viewport);
      }),
  };
}

/** Where the content sits in the viewport, and the input that moves it. */
function useCamera(
  target: RefObject<HTMLDivElement | null>,
  { width, height }: Size,
): Moves & { view: View | null } {
  const [view, setView] = useState<View | null>(null);
  const [room, setRoom] = useState<Size | null>(null);
  const moves = useMemo(() => movesFor(setView, room, { width, height }), [room, width, height]);

  useEffect(() => {
    const element = target.current;
    if (!element) return undefined;
    const size = { width, height };
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      setRoom(next);
      setView((current) => (current ? clamp(current, size, next) : fitView(size, next)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, width, height]);

  useEffect(() => {
    const found = target.current;
    if (!found) return undefined;
    const element: HTMLDivElement = found;
    const { zoomAt, panBy, reset, toggle } = moves;
    const pointers = new Map<number, Point>();
    let gestureScale = 1;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      const dx = event.deltaX * unit;
      const dy = event.deltaY * unit;
      // Browsers report a trackpad pinch as a wheel event with ctrlKey set.
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.min(2, Math.max(0.5, Math.exp(-dy * 0.004)));
        zoomAt(factor, pointIn(element, event.clientX, event.clientY));
      } else if (event.shiftKey && dx === 0) {
        panBy(-dy, 0);
      } else {
        panBy(-dx, -dy);
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      element?.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    function onPointerMove(event: PointerEvent) {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const now = { x: event.clientX, y: event.clientY };
      const other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = distance(previous, other);
        const midpoint = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
        if (before > 0)
          zoomAt(distance(now, other) / before, pointIn(element, midpoint.x, midpoint.y));
        panBy((now.x - previous.x) / 2, (now.y - previous.y) / 2);
      } else {
        panBy(now.x - previous.x, now.y - previous.y);
      }
      pointers.set(event.pointerId, now);
    }

    function onPointerEnd(event: PointerEvent) {
      pointers.delete(event.pointerId);
    }

    function onDoubleClick(event: MouseEvent) {
      toggle(pointIn(element, event.clientX, event.clientY));
    }

    function onKeyDown(event: KeyboardEvent) {
      const actions: Record<string, () => void> = {
        "+": () => zoomAt(1.25),
        "=": () => zoomAt(1.25),
        "-": () => zoomAt(0.8),
        "0": reset,
        ArrowLeft: () => panBy(KEY_STEP, 0),
        ArrowRight: () => panBy(-KEY_STEP, 0),
        ArrowUp: () => panBy(0, KEY_STEP),
        ArrowDown: () => panBy(0, -KEY_STEP),
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    }

    // Safari reports a trackpad pinch only through its own gesture events.
    function onGestureStart(event: Event) {
      event.preventDefault();
      gestureScale = 1;
    }
    function onGestureChange(event: Event) {
      event.preventDefault();
      if (!isGesture(event)) return;
      zoomAt(event.scale / gestureScale, pointIn(element, event.clientX, event.clientY));
      gestureScale = event.scale;
    }

    const abort = new AbortController();
    const { signal } = abort;
    element.addEventListener("wheel", onWheel, { passive: false, signal });
    element.addEventListener("pointerdown", onPointerDown, { signal });
    element.addEventListener("pointermove", onPointerMove, { signal });
    element.addEventListener("pointerup", onPointerEnd, { signal });
    element.addEventListener("pointercancel", onPointerEnd, { signal });
    element.addEventListener("dblclick", onDoubleClick, { signal });
    element.addEventListener("keydown", onKeyDown, { signal });
    element.addEventListener("gesturestart", onGestureStart, { signal });
    element.addEventListener("gesturechange", onGestureChange, { signal });
    return () => abort.abort();
  }, [target, moves]);

  return { view, ...moves };
}

function fitView(content: Size, box: Size): View {
  const scale = Math.min(
    (box.width - EDGE) / content.width,
    (box.height - EDGE) / content.height,
    MAX_FIT,
  );
  return clamp({ scale, x: 0, y: 0 }, content, box);
}

function zoom(view: View, factor: number, point: Point, content: Size, box: Size): View {
  const minimum = fitView(content, box).scale * 0.75;
  const scale = Math.min(MAX_SCALE, Math.max(minimum, view.scale * factor));
  const ratio = scale / view.scale;
  return clamp(
    { scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio },
    content,
    box,
  );
}

/** Centres content smaller than the viewport, and keeps larger content from leaving it. */
function clamp(view: View, content: Size, box: Size): View {
  return {
    scale: view.scale,
    x: clampAxis(view.x, content.width * view.scale, box.width),
    y: clampAxis(view.y, content.height * view.scale, box.height),
  };
}

function clampAxis(offset: number, size: number, room: number): number {
  if (size <= room - EDGE) return (room - size) / 2;
  return Math.min(EDGE / 2, Math.max(room - size - EDGE / 2, offset));
}

function center(box: Size): Point {
  return { x: box.width / 2, y: box.height / 2 };
}

function pointIn(element: HTMLElement, clientX: number, clientY: number): Point {
  const rect = element.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

type GestureEvent = Event & { scale: number; clientX: number; clientY: number };

function isGesture(event: Event): event is GestureEvent {
  return "scale" in event && "clientX" in event;
}
