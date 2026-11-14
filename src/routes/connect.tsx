import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";

import { getConnectRequest, nameConnectingAgent } from "#/functions/agents.functions";
import { authClient } from "#/lib/auth-client";
import { textField } from "#/lib/form";

export const Route = createFileRoute("/connect")({
  // The signature covers the raw query, repeated keys included, which the router's parsed search
  // does not keep. So this page renders in the browser, where window.location has it intact.
  ssr: false,
  loader: () => getConnectRequest({ data: { search: window.location.search } }),
  head: () => ({ meta: [{ title: "Connect an agent, evergarden" }] }),
  component: Connect,
  errorComponent: ConnectFailed,
});

function Connect() {
  const request = Route.useLoaderData();
  const software = request.clientName ?? "An agent";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function allow(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = textField(new FormData(event.currentTarget), "name");
    setPending(true);
    setError(null);
    try {
      await nameConnectingAgent({ data: { search: window.location.search, name } });
      const result = await authClient.oauth2.consent({ accept: true });
      if (result.error) throw new Error(result.error.message ?? "The agent was not connected.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The agent was not connected.");
      setPending(false);
    }
  }

  async function deny() {
    setPending(true);
    await authClient.oauth2.consent({ accept: false });
  }

  return (
    <main id="main" className="sign-in">
      <p className="wordmark wordmark-large">evergarden</p>
      <h1 className="sign-in-title">
        {software} wants to read, publish and update the documents in your library.
      </h1>
      <form className="sign-in-form" onSubmit={(event) => void allow(event)}>
        <label className="field">
          <span>Name</span>
          <input
            name="name"
            required
            maxLength={40}
            defaultValue={request.suggestedName}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="field-note">
          This name signs what the agent writes. Afterwards your browser goes back to{" "}
          <code>{request.returnsTo}</code>.
        </p>
        <div className="connect-actions">
          <button type="submit" className="button" disabled={pending}>
            Allow
          </button>
          <button
            type="button"
            className="quiet-button"
            disabled={pending}
            onClick={() => void deny()}
          >
            Deny
          </button>
        </div>
      </form>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function ConnectFailed({ error }: ErrorComponentProps) {
  return (
    <main id="main" className="letter">
      <h1>This agent could not connect</h1>
      <p>{error instanceof Error ? error.message : "Start connecting from the agent again."}</p>
    </main>
  );
}
