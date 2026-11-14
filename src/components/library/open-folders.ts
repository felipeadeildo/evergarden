import { useMemo, useSyncExternalStore } from "react";

const KEY = "evergarden:open-folders";
const listeners = new Set<() => void>();

/**
 * Which folders the library shows open, kept in this browser across visits. The server renders
 * every folder closed; the stored ones open once the page hydrates.
 */
export function useOpenFolders(): {
  isOpen: (id: string) => boolean;
  setOpen: (id: string, open: boolean) => void;
} {
  const stored = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const open = useMemo(() => new Set(parse(stored)), [stored]);

  function setOpen(id: string, isOpen: boolean) {
    if (open.has(id) === isOpen) return;
    const next = new Set(open);
    if (isOpen) next.add(id);
    else next.delete(id);
    localStorage.setItem(KEY, JSON.stringify([...next]));
    for (const listener of listeners) listener();
  }

  return { isOpen: (id) => open.has(id), setOpen };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): string {
  return localStorage.getItem(KEY) ?? "[]";
}

function parse(stored: string): string[] {
  try {
    const ids: unknown = JSON.parse(stored);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
