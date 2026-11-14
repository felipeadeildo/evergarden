import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useOpenSearch } from "./search";

/** The quiet bar above every library page: the name, where you are, search and settings. */
export function TopBar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  const openSearch = useOpenSearch();
  return (
    <header className="top-bar">
      <Link to="/" className="wordmark">
        evergarden
      </Link>
      <div className="top-bar-place">{children}</div>
      <div className="top-bar-actions">
        {actions}
        <button
          type="button"
          className="quiet-button"
          onClick={openSearch}
          aria-keyshortcuts="Meta+K"
        >
          Search
          <kbd className="shortcut">⌘K</kbd>
        </button>
        <Link to="/settings" className="quiet-button">
          Settings
        </Link>
      </div>
    </header>
  );
}
