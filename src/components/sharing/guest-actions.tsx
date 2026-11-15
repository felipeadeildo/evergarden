import { Link } from "@tanstack/react-router";

import { SignOutIcon } from "#/components/ui/icons";
import type { Viewer } from "#/functions/session.functions";
import { authClient } from "#/lib/auth-client";

/**
 * The top bar's end on a shared page: a way to sign in to comment, or who the guest is signed in
 * as and a way out. `shared` names the page for the sign-in code (`document:<id>`).
 */
export function GuestActions({
  viewer,
  canComment,
  path,
  shared,
}: {
  viewer: Viewer | null;
  canComment: boolean;
  path: string;
  shared: string;
}) {
  if (viewer) {
    return (
      <button
        type="button"
        className="quiet-button"
        title={`Signed in as ${viewer.name}`}
        onClick={() => void authClient.signOut().then(() => window.location.reload())}
      >
        <SignOutIcon />
        <span className="label">Sign out</span>
      </button>
    );
  }
  if (!canComment) return null;
  return (
    <Link to="/sign-in" search={{ next: path, shared }} className="quiet-button guest-sign-in">
      Sign in to comment
    </Link>
  );
}
