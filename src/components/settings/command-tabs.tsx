import { useId, useState } from "react";

import { CopyButton } from "#/components/ui/copy-button";
import { ShellLine } from "#/components/ui/shell-line";

import type { AgentCommand } from "./agent-commands";

export function CommandTabs({ commands }: { commands: AgentCommand[] }) {
  const [chosen, setChosen] = useState(0);
  const command = commands[chosen]!;
  const tabsId = useId();

  return (
    <>
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
    </>
  );
}
