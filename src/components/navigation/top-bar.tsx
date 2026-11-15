import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SearchIcon, SettingsIcon } from "#/components/ui/icons";
import { Wordmark } from "#/components/ui/wordmark";

import { useOpenSearch } from "./search";

/**
 * The bar over every page. Under a share link (`shared`), it holds no way into the library: the
 * wordmark leads back to what was shared, and search and settings are gone.
 */
export function TopBar({
  children,
  actions,
  shared,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  shared?: { home: string };
}) {
  if (shared) {
    return (
      <header className="top-bar">
        <a href={shared.home} className="wordmark-link">
          <Wordmark />
        </a>
        <div className="top-bar-place">{children}</div>
        <div className="top-bar-actions">{actions}</div>
      </header>
    );
  }
  return <LibraryBar actions={actions}>{children}</LibraryBar>;
}

function LibraryBar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  const openSearch = useOpenSearch();
  return (
    <header className="top-bar">
      <Link to="/" className="wordmark-link">
        <Wordmark />
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
          <SearchIcon />
          <span className="label">Search</span>
          <kbd className="shortcut">⌘K</kbd>
        </button>
        <Link to="/settings" className="quiet-button">
          <SettingsIcon />
          <span className="label">Settings</span>
        </Link>
      </div>
    </header>
  );
}
