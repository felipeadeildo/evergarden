import { authClient } from "#/lib/auth-client";

/** What someone signed in sees on a page that was not shared with them. */
export function Private({ name }: { name: string }) {
  return (
    <main id="main" className="letter">
      <h1>This library is private</h1>
      <p>
        You are signed in as {name}. This page was not shared with you; whoever sent you here can
        share it from the page itself.
      </p>
      <button
        type="button"
        className="button"
        onClick={() => void authClient.signOut().then(() => window.location.assign("/sign-in"))}
      >
        Sign out
      </button>
    </main>
  );
}
