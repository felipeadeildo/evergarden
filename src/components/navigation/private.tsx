import { authClient } from "#/lib/auth-client";

/**
 * What someone signed in sees on a page that was not shared with them. It names their own address
 * but never who the page is shared with: anyone holding the link would learn that.
 */
export function Private({ email, retry = "/sign-in" }: { email: string; retry?: string }) {
  return (
    <main id="main" className="letter">
      <h1>You don’t have access</h1>
      <p>
        You are signed in as <strong>{email}</strong>, which this page was not shared with. If it
        was shared with another of your addresses, sign in with that one; otherwise, ask whoever
        sent you the link to add you.
      </p>
      <button
        type="button"
        className="button"
        onClick={() => void authClient.signOut().then(() => window.location.assign(retry))}
      >
        Use another email
      </button>
    </main>
  );
}
