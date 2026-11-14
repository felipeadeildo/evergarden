export type AgentCommand = {
  client: string;
  lines: string[];
  note?: string;
};

const NAME = "evergarden";

/** Codex takes a token only from an environment variable, so its key case needs an export. */
export function agentCommands(server: string, key?: string): AgentCommand[] {
  return key ? withKey(server, key) : withOAuth(server);
}

function withOAuth(server: string): AgentCommand[] {
  return [
    { client: "pi", lines: [`pi mcp add ${NAME} --url ${server}`, `pi mcp login ${NAME}`] },
    {
      client: "Claude Code",
      lines: [`claude mcp add --transport http ${NAME} ${server}`],
      note: "Then run /mcp inside Claude Code and choose Authenticate.",
    },
    {
      client: "Codex",
      lines: [`codex mcp add ${NAME} --url ${server}`, `codex mcp login ${NAME}`],
    },
    {
      client: "Gemini CLI",
      lines: [`gemini mcp add --transport http ${NAME} ${server}`],
      note: `Then run /mcp auth ${NAME} inside Gemini CLI.`,
    },
  ];
}

function withKey(server: string, key: string): AgentCommand[] {
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
