import { createFileRoute } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { z } from "zod";

import { GithubIcon, GoogleIcon } from "#/components/ui/icons";
import { getSignInMethods } from "#/functions/session.functions";
import { authClient } from "#/lib/auth-client";
import { textField } from "#/lib/form";
import { resumeAuthorizeUrl } from "#/lib/oauth-flow";

export const Route = createFileRoute("/sign-in")({
  // .loose() keeps the signed OAuth parameters an agent's sign-in arrives with.
  validateSearch: z.object({ next: z.string().optional() }).loose(),
  loader: () => getSignInMethods(),
  head: () => ({ meta: [{ title: "Sign in to evergarden" }] }),
  component: SignIn,
});

/** Only same-site paths are followed after signing in. */
function safeNext(next: string | undefined): string {
  if (!next) return "/";
  try {
    const url = new URL(next, "http://local");
    return url.origin === "http://local" ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

/** The authorize request to resume when an agent sent the owner here; read from the real URL. */
function resumeAgentSignIn(): string | null {
  return typeof window === "undefined" ? null : resumeAuthorizeUrl(window.location.search);
}

function SignIn() {
  const methods = Route.useLoaderData();
  const search = Route.useSearch();
  const callbackURL = resumeAgentSignIn() ?? safeNext(search.next);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function social(provider: "github" | "google") {
    setPending(true);
    const result = await authClient.signIn.social({ provider, callbackURL });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed. Try again.");
      setPending(false);
    }
  }

  async function withPassword(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await authClient.signIn.email({
      email: textField(form, "email"),
      password: textField(form, "password"),
    });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed. Check the email and password.");
      setPending(false);
      return;
    }
    window.location.assign(callbackURL);
  }

  return (
    <main id="main" className="sign-in">
      <p className="wordmark wordmark-large">evergarden</p>
      <h1 className="sign-in-title">Sign in to read and comment on your documents.</h1>
      <div className="sign-in-methods">
        {methods.github ? (
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={() => void social("github")}
          >
            <GithubIcon />
            Continue with GitHub
          </button>
        ) : null}
        {methods.google ? (
          <button
            type="button"
            className="button"
            disabled={pending}
            onClick={() => void social("google")}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        ) : null}
        {methods.password ? (
          <form className="sign-in-form" onSubmit={(event) => void withPassword(event)}>
            <p className="field-note">Email and password work only in local development.</p>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required spellCheck={false} />
            </label>
            <label className="field">
              <span>Password</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit" className="button" disabled={pending}>
              Sign in
            </button>
          </form>
        ) : null}
        {!methods.github && !methods.google && !methods.password ? (
          <p>
            No sign-in method is configured. Set <code>GITHUB_CLIENT_ID</code> and{" "}
            <code>GITHUB_CLIENT_SECRET</code> for this deployment.
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </main>
  );
}
