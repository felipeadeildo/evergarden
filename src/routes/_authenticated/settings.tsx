import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";

import { TopBar } from "#/components/navigation/top-bar";
import { KeyIcon, SignOutIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import { authClient } from "#/lib/auth-client";
import { textField } from "#/lib/form";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings, evergarden" }] }),
  component: Settings,
});

type Key = {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: Date;
  lastRequest: Date | null;
};

function Settings() {
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: keys, refetch } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async (): Promise<Key[]> => {
      const result = await authClient.apiKey.list();
      if (result.error) throw new Error(result.error.message ?? "The keys could not be loaded.");
      return result.data.apiKeys;
    },
  });

  async function create(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const name = textField(new FormData(formElement), "name");
    const result = await authClient.apiKey.create({ name });
    if (result.error) {
      setError(result.error.message ?? "The key could not be created.");
      return;
    }
    setCreated({ name, key: result.data.key });
    formElement.reset();
    await refetch();
  }

  async function revoke(key: Key) {
    if (!window.confirm(`Revoke the key "${key.name ?? key.start}"? Agents using it stop working.`))
      return;
    await authClient.apiKey.delete({ keyId: key.id });
    await refetch();
  }

  return (
    <>
      <TopBar />
      <main id="main" className="settings">
        <h1>Settings</h1>

        <section aria-labelledby="agents-heading" className="settings-section">
          <h2 id="agents-heading">Agents</h2>
          <p>
            Each agent signs in with its own key. The key&rsquo;s name appears as the author of what
            the agent writes.
          </p>

          {created ? <NewKey name={created.name} apiKey={created.key} /> : null}

          <form className="inline-form" onSubmit={(event) => void create(event)}>
            <label className="field">
              <span>Name</span>
              <input name="name" required maxLength={40} placeholder="pi" autoComplete="off" />
            </label>
            <button type="submit" className="button">
              Create key
            </button>
          </form>

          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}

          {keys && keys.length > 0 ? (
            <ul className="key-list">
              {keys.map((key) => (
                <li key={key.id}>
                  <span className="key-name">
                    <KeyIcon />
                    {key.name ?? "Unnamed"}
                  </span>
                  <code className="key-start">{key.start}…</code>
                  <span className="key-meta">
                    {key.lastRequest ? (
                      <>
                        Used <RelativeTime date={new Date(key.lastRequest)} />
                      </>
                    ) : (
                      "Never used"
                    )}
                  </span>
                  <button
                    type="button"
                    className="quiet-button danger"
                    onClick={() => void revoke(key)}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {keys?.length === 0 && !created ? <p className="field-note">No keys yet.</p> : null}
        </section>

        <section className="settings-section">
          <h2>Account</h2>
          <button
            type="button"
            className="quiet-button"
            onClick={() => void authClient.signOut().then(() => window.location.assign("/sign-in"))}
          >
            <SignOutIcon />
            Sign out
          </button>
        </section>
      </main>
    </>
  );
}

function NewKey({ name, apiKey }: { name: string; apiKey: string }) {
  const config = JSON.stringify(
    {
      mcpServers: {
        evergarden: {
          url: `${window.location.origin}/mcp`,
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      },
    },
    null,
    2,
  );
  return (
    <div className="new-key">
      <p>
        Key for <strong>{name}</strong> created. Copy it now: it is not shown again. Add this MCP
        server to the agent:
      </p>
      <pre>
        <code>{config}</code>
      </pre>
      <button
        type="button"
        className="button"
        onClick={() => void navigator.clipboard.writeText(config)}
      >
        Copy configuration
      </button>
    </div>
  );
}
