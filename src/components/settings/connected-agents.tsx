import { useState } from "react";

import { KeyIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";

import { type AgentKey, useAgentKeys } from "./use-agent-keys";

/** The agents with a key: when each last reached the library, and a way to lock it out. */
export function ConnectedAgents() {
  const { keys, revoke } = useAgentKeys();

  if (keys.isError) return <p className="form-error">{keys.error.message}</p>;
  if (!keys.data) return null;
  if (keys.data.length === 0) return <p className="page-note">No agents connected yet.</p>;

  return (
    <ul className="rows">
      {keys.data.map((entry) => (
        <AgentRow key={entry.id} entry={entry} onRevoke={() => revoke(entry.id)} />
      ))}
    </ul>
  );
}

function AgentRow({ entry, onRevoke }: { entry: AgentKey; onRevoke: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const name = entry.name ?? "Unnamed agent";

  return (
    <li>
      <div className="row row-static" title={`Key ${entry.start ?? ""}…`}>
        <KeyIcon className="row-icon" />
        <span className="row-name row-signature">{name}</span>
        <span className="row-place">
          {entry.lastRequest ? (
            <>
              used <RelativeTime date={new Date(entry.lastRequest)} short />
            </>
          ) : (
            "never used"
          )}
        </span>
        <span className="row-end">
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
            {name} stops working at once.
            <button type="button" className="row-action danger" onClick={() => void onRevoke()}>
              Revoke key
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
