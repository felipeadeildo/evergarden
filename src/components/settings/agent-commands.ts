/** One agent's way to add the evergarden MCP server from a terminal. */
export type AgentCommand = {
  client: string;
  /** The shell lines to run, in order. */
  lines: string[];
  note?: string;
};

const NAME = "evergarden";

/**
 * The command each supported agent CLI takes to add this server with `key`. Syntax checked
 * against each CLI's docs: pi `--header KEY=VALUE`, Claude Code and Gemini CLI
 * `--header "Name: value"`, Codex only reads the token from an environment variable.
 */
export function agentCommands(server: string, key: string): AgentCommand[] {
  return [
    {
      client: "pi",
      lines: [`pi mcp add ${NAME} --url ${server} --header "Authorization=Bearer ${key}"`],
    },
    {
      client: "Claude Code",
      lines: [
        `claude mcp add --transport http ${NAME} ${server} --header "Authorization: Bearer ${key}"`,
      ],
    },
    {
      client: "Codex",
      lines: [
        `export EVERGARDEN_KEY=${key}`,
        `codex mcp add ${NAME} --url ${server} --bearer-token-env-var EVERGARDEN_KEY`,
      ],
      note: "Codex reads the key from EVERGARDEN_KEY each time it starts, so set it in your shell profile too.",
    },
    {
      client: "Gemini CLI",
      lines: [
        `gemini mcp add --transport http --header "Authorization: Bearer ${key}" ${NAME} ${server}`,
      ],
    },
  ];
}
