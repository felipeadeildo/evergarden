import { type SubmitEvent, useState } from "react";

import { CopyButton } from "#/components/ui/copy-button";
import { textField } from "#/lib/form";

import { agentCommands } from "./agent-commands";
import { CommandTabs } from "./command-tabs";
import { useAgents } from "./use-agents";

/**
 * How to connect an agent. Agents sign in over OAuth: add the server, and the first connection
 * opens the browser here to name the agent. A key is the fallback for clients without OAuth.
 */
export function ConnectAgent({ server }: { server: string }) {
  const [withKey, setWithKey] = useState(false);

  if (withKey) return <KeyForm server={server} onCancel={() => setWithKey(false)} />;

  return (
    <div className="new-key">
      <p className="new-key-label">Server address</p>
      <div className="line">
        <code>{server}</code>
        <CopyButton text={server} label="Copy address" iconOnly />
      </div>
      <p className="new-key-label">Add it from a terminal</p>
      <CommandTabs commands={agentCommands(server)} />
      <p className="connect-note">
        The first time the agent connects, your browser opens evergarden to name it.{" "}
        <button type="button" className="link-button" onClick={() => setWithKey(true)}>
          Use an API key instead
        </button>
      </p>
    </div>
  );
}

/** Names an agent and hands back a key for it, shown only this once. */
function KeyForm({ server, onCancel }: { server: string; onCancel: () => void }) {
  const { createKey } = useAgents();
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = textField(new FormData(event.currentTarget), "name");
    setBusy(true);
    setError(null);
    try {
      setCreated({ name, key: await createKey(name) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The key was not created.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="new-key">
        <p className="new-key-label">
          Key for <strong>{created.name}</strong>, shown only this once
        </p>
        <div className="line">
          <code>{created.key}</code>
          <CopyButton text={created.key} label="Copy key" iconOnly />
        </div>
        <p className="new-key-label">Add it from a terminal</p>
        <CommandTabs commands={agentCommands(server, created.key)} />
        <button type="button" className="link-button new-key-done" onClick={onCancel}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form className="connect" onSubmit={(event) => void onSubmit(event)}>
      <label className="connect-field">
        <span className="sr-only">Agent name</span>
        <input
          name="name"
          required
          maxLength={40}
          placeholder="Agent name, such as pi"
          autoComplete="off"
        />
      </label>
      <button type="submit" className="button" disabled={busy}>
        {busy ? "Creating…" : "Create key"}
      </button>
      <p className="connect-note connect-error">
        {error ? (
          <span role="alert" className="form-error">
            {error}{" "}
          </span>
        ) : null}
        <button type="button" className="link-button" onClick={onCancel}>
          Sign agents in with OAuth instead
        </button>
      </p>
    </form>
  );
}
