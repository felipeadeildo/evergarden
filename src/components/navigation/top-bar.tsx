import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SearchIcon, SettingsIcon } from "#/components/ui/icons";
import { Wordmark } from "#/components/ui/wordmark";

import { useOpenSearch } from "./search";

export function TopBar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
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
