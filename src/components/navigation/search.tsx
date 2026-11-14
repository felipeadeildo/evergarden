import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { DocumentIcon, SearchIcon } from "#/components/ui/icons";
import { Sheet } from "#/components/ui/sheet";
import { searchDocuments } from "#/functions/library.functions";

const SearchContext = createContext<() => void>(() => {});

export function useOpenSearch(): () => void {
  return useContext(SearchContext);
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea");
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SearchContext.Provider value={show}>
      {children}
      <Sheet open={open} onClose={() => setOpen(false)} label="Search" className="search-sheet">
        <SearchPanel onDone={() => setOpen(false)} />
      </Sheet>
    </SearchContext.Provider>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SearchPanel({ onDone }: { onDone: () => void }) {
  const search = useServerFn(searchDocuments);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query.trim(), 120);

  const { data } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => search({ data: { query: debounced } }),
    enabled: debounced.length > 0,
    placeholderData: keepPreviousData,
  });
  const hits = query.trim() && data ? data : [];
  const current = Math.min(active, hits.length - 1);

  function openHit(index: number) {
    const hit = hits[index];
    if (!hit) return;
    onDone();
    void navigate({ to: "/d/$id", params: { id: hit.id } });
  }

  return (
    <div className="search">
      <div className="search-field">
        <SearchIcon />
        <input
          type="search"
          className="search-input"
          placeholder="Search titles and text"
          aria-label="Search titles and text"
          autoComplete="off"
          data-autofocus
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive(Math.min(current + 1, hits.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive(Math.max(current - 1, 0));
            } else if (event.key === "Enter") {
              openHit(current);
            }
          }}
        />
      </div>
      {hits.length > 0 ? (
        <ul className="search-results" aria-label="Results">
          {hits.map((hit, index) => (
            <li key={hit.id} data-active={index === current || undefined}>
              <Link
                to="/d/$id"
                params={{ id: hit.id }}
                onClick={onDone}
                onPointerEnter={() => setActive(index)}
              >
                <span className="search-title">
                  <DocumentIcon />
                  {hit.title}
                </span>
                <Excerpt text={hit.excerpt} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {debounced && data?.length === 0 ? (
        <p className="search-empty">No documents match “{debounced}”.</p>
      ) : null}
    </div>
  );
}

function Excerpt({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const [index, part] of text.split(/«|»/).entries()) {
    parts.push(index % 2 === 1 ? <mark key={offset}>{part}</mark> : part);
    offset += part.length + 1;
  }
  return <span className="search-excerpt">{parts}</span>;
}
