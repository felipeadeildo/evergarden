import { useEffect, useState } from "react";

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
      const line = window.innerHeight / 3;
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
  return (
    <nav aria-label="Contents" className="toc">
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
