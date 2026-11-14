import { createFileRoute } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { z } from "zod";

import { authClient } from "#/lib/auth-client";
import { textField } from "#/lib/form";
import { resumeAuthorizeUrl } from "#/lib/oauth-flow";

export const Route = createFileRoute("/sign-in")({
  // .loose() keeps the signed OAuth parameters an agent's sign-in arrives with.
  validateSearch: z.object({ next: z.string().optional() }).loose(),
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
  const search = Route.useSearch();
  const [email, setEmail] = useState<string | null>(null);

  return (
    <main id="main" className="sign-in">
      <p className="wordmark wordmark-large">evergarden</p>
      {email === null ? (
        <EmailStep onSent={setEmail} />
      ) : (
        <CodeStep
          email={email}
          next={resumeAgentSignIn() ?? safeNext(search.next)}
          onChangeEmail={() => setEmail(null)}
        />
      )}
    </main>
  );
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = textField(new FormData(event.currentTarget), "email").trim();
    setPending(true);
    const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "The code could not be sent. Try again.");
      return;
    }
    onSent(email);
  }

  return (
    <>
      <h1 className="sign-in-title">Sign in to read and comment on your documents.</h1>
      <form className="sign-in-form" onSubmit={(event) => void send(event)}>
        <label className="field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            spellCheck={false}
            placeholder="you@example.com"
          />
        </label>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Sending…" : "Send code"}
        </button>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
      </form>
    </>
  );
}

function CodeStep({
  email,
  next,
  onChangeEmail,
}: {
  email: string;
  next: string;
  onChangeEmail: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState(false);

  async function signIn(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const otp = textField(new FormData(event.currentTarget), "code").replace(/\s/g, "");
    setPending(true);
    const result = await authClient.signIn.emailOtp({ email, otp });
    if (result.error) {
      setError("That code did not work. Check it, or send a new one.");
      setPending(false);
      return;
    }
    window.location.assign(next);
  }

  async function resend() {
    setError(null);
    await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setResent(true);
  }

  return (
    <>
      <h1 className="sign-in-title">
        If <strong>{email}</strong> can sign in here, a code is on its way.
      </h1>
      <form className="sign-in-form" onSubmit={(event) => void signIn(event)}>
        <label className="field">
          <span>Code</span>
          <input
            name="code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            // The page shows only this field, and the code was just sent to it.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </label>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
      </form>
      <p className="sign-in-help">
        {resent ? "Sent another code. " : null}
        <button type="button" className="link-button" onClick={() => void resend()}>
          Send another code
        </button>{" "}
        or{" "}
        <button type="button" className="link-button" onClick={onChangeEmail}>
          use another email
        </button>
        .
      </p>
    </>
  );
}
