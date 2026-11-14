import { type SubmitEvent, useState } from "react";

import { CopyButton } from "#/components/ui/copy-button";
import { textField } from "#/lib/form";

import { useAgentKeys } from "./use-agent-keys";

type Connected = { name: string; config: string };

/**
 * Names a new agent and hands back what to paste into it: an MCP configuration with this
 * deployment's address and the agent's key already inside. The key is shown only this once.
 */
export function ConnectAgent({ server }: { server: string }) {
  const { create } = useAgentKeys();
  const [connected, setConnected] = useState<Connected | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = textField(new FormData(event.currentTarget), "name");
    setBusy(true);
    setError(null);
    try {
      setConnected({ name, config: mcpConfig(server, await create(name)) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The key was not created.");
    } finally {
      setBusy(false);
    }
  }

  if (connected) {
    return (
      <div className="connect connect-ready">
        <p className="connect-title">
          <strong>{connected.name}</strong> is ready
        </p>
        <div className="snippet">
          <pre>
            <code>{connected.config}</code>
          </pre>
          <CopyButton text={connected.config} label="Copy configuration" iconOnly />
        </div>
        <p className="connect-note">
          Paste this into the agent&rsquo;s MCP settings. evergarden shows the key only this once.{" "}
          <button type="button" className="link-button" onClick={() => setConnected(null)}>
            Connect another agent
          </button>
        </p>
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
      {error ? (
        <p role="alert" className="form-error connect-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function mcpConfig(server: string, key: string): string {
  return JSON.stringify(
    { mcpServers: { evergarden: { url: server, headers: { Authorization: `Bearer ${key}` } } } },
    null,
    2,
  );
}
