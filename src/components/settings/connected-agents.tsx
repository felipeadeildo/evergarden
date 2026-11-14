import { useState } from "react";

import { KeyIcon, ServerIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import type { AgentEntry } from "#/server/agents";

import { useAgents } from "./use-agents";

/** Every agent with access, however it connected, and a way to lock each one out. */
export function ConnectedAgents() {
  const { agents, revoke } = useAgents();

  if (agents.isError) return <p className="form-error">{agents.error.message}</p>;
  if (!agents.data) return null;
  if (agents.data.length === 0) return <p className="page-note">No agents connected yet.</p>;

  return (
    <ul className="rows">
      {agents.data.map((entry) => (
        <AgentRow key={entry.id} entry={entry} onRevoke={() => revoke(entry.id)} />
      ))}
    </ul>
  );
}

function AgentRow({ entry, onRevoke }: { entry: AgentEntry; onRevoke: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const Icon = entry.method === "oauth" ? ServerIcon : KeyIcon;
  const how = entry.method === "oauth" ? `${entry.client ?? "OAuth"}, signed in` : "API key";

  return (
    <li>
      <div className="row row-static">
        <Icon className="row-icon" />
        <span className="row-name row-signature">{entry.name}</span>
        <span className="row-place">{how}</span>
        <span className="row-end">
          {entry.lastUsedAt ? (
            <RelativeTime date={new Date(entry.lastUsedAt)} short />
          ) : (
            <span>never</span>
          )}
          <button
            type="button"
            className="row-action danger"
            aria-expanded={confirming}
            onClick={() => setConfirming(!confirming)}
          >
            Revoke
          </button>
        </span>
        {confirming ? (
          <p className="row-confirm" role="alert">
            {entry.name} stops working at once.
            <button type="button" className="row-action danger" onClick={() => void onRevoke()}>
              Revoke access
            </button>
            <button type="button" className="row-action" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </p>
        ) : null}
      </div>
    </li>
  );
}
