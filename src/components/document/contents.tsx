import { type RefObject, useEffect, useRef, useState } from "react";

import type { Heading } from "#/render";

/** Follows the section being read: the last heading that has passed the top third of the screen. */
function useCurrentHeading(headings: Heading[]): string | undefined {
  const [current, setCurrent] = useState(headings[0]?.id);

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element) => element !== null);
    if (elements.length === 0) return undefined;

    function update() {
      // At the end of the page the last headings never reach the top third, so the line drops to
      // the bottom of the screen: the last heading in view counts as the one being read.
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const line = atEnd ? window.innerHeight : window.innerHeight / 3;
      let found = elements[0]?.id;
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= line) found = element.id;
      }
      setCurrent(found);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [headings]);

  return current;
}

export function Contents({
  headings,
  onNavigate,
}: {
  headings: Heading[];
  onNavigate?: () => void;
}) {
  const current = useCurrentHeading(headings);
  const nav = useRef<HTMLElement>(null);
  const more = useFollow(nav, current);
  return (
    <nav ref={nav} aria-label="Contents" className="toc" data-more={more || undefined}>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id} data-depth={heading.depth}>
            <a
              href={`#${heading.id}`}
              aria-current={heading.id === current ? "location" : undefined}
              onClick={onNavigate}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Keeps the current heading in view when the list is taller than the screen, and says which ends
 * have more headings past them ("top", "bottom", both or neither), so CSS fades only those ends.
 */
function useFollow(nav: RefObject<HTMLElement | null>, current: string | undefined): string {
  const [more, setMore] = useState("");

  useEffect(() => {
    const list = nav.current;
    if (!list) return undefined;
    const element: HTMLElement = list;
    function mark() {
      const ends = [
        element.scrollTop > 1 ? "top" : "",
        element.scrollTop + element.clientHeight < element.scrollHeight - 1 ? "bottom" : "",
      ];
      setMore(ends.filter(Boolean).join(" "));
    }
    mark();
    const observer = new ResizeObserver(mark);
    observer.observe(element);
    element.addEventListener("scroll", mark, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", mark);
    };
  }, [nav]);

  useEffect(() => {
    const list = nav.current;
    if (!list || !current || list.scrollHeight <= list.clientHeight) return;
    const link = list.querySelector<HTMLElement>(`a[href="#${CSS.escape(current)}"]`);
    if (!link) return;
    const margin = list.clientHeight / 4;
    const top =
      link.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    if (top < list.scrollTop + margin || top > list.scrollTop + list.clientHeight - margin) {
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      list.scrollTo({ top: top - list.clientHeight / 2, behavior: still ? "auto" : "smooth" });
    }
  }, [nav, current]);

  return more;
}
