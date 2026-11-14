import { type SubmitEvent, useId, useState } from "react";

import { CopyButton } from "#/components/ui/copy-button";
import { ShellLine } from "#/components/ui/shell-line";
import { textField } from "#/lib/form";

import { agentCommands } from "./agent-commands";
import { useAgentKeys } from "./use-agent-keys";

type Created = { name: string; key: string };

/**
 * Names a new agent and hands back its key, shown only this once, with the one command that adds
 * evergarden to each common agent CLI.
 */
export function ConnectAgent({ server }: { server: string }) {
  const { create } = useAgentKeys();
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = textField(new FormData(event.currentTarget), "name");
    setBusy(true);
    setError(null);
    try {
      setCreated({ name, key: await create(name) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The key was not created.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return <NewKey created={created} server={server} onDone={() => setCreated(null)} />;
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

function NewKey({
  created,
  server,
  onDone,
}: {
  created: Created;
  server: string;
  onDone: () => void;
}) {
  const commands = agentCommands(server, created.key);
  const [chosen, setChosen] = useState(0);
  const command = commands[chosen]!;
  const tabsId = useId();

  return (
    <div className="new-key">
      <p className="new-key-label">
        Key for <strong>{created.name}</strong>, shown only this once
      </p>
      <div className="line">
        <code>{created.key}</code>
        <CopyButton text={created.key} label="Copy key" iconOnly />
      </div>

      <p className="new-key-label">Or add it from a terminal</p>
      <div role="tablist" aria-label="Agent" className="segmented">
        {commands.map((entry, index) => (
          <button
            key={entry.client}
            type="button"
            role="tab"
            id={`${tabsId}-${index}`}
            aria-selected={index === chosen}
            aria-controls={`${tabsId}-panel`}
            onClick={() => setChosen(index)}
          >
            {entry.client}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${chosen}`}>
        <div className="line line-command">
          <code>
            {command.lines.map((text) => (
              <ShellLine key={text} text={text} />
            ))}
          </code>
          <CopyButton text={command.lines.join("\n")} label="Copy command" iconOnly />
        </div>
        {command.note ? <p className="connect-note">{command.note}</p> : null}
      </div>

      <button type="button" className="link-button new-key-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
