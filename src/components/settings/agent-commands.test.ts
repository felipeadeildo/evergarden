import { describe, expect, it } from "vitest";

import { agentCommands } from "./agent-commands";

describe("agentCommands", () => {
  const commands = agentCommands("https://evergarden.example.com/mcp", "eg_abc");

  it("puts the address and the key in every client's command", () => {
    for (const { lines } of commands) {
      const all = lines.join("\n");
      expect(all).toContain("https://evergarden.example.com/mcp");
      expect(all).toContain("eg_abc");
    }
  });

  it("uses pi's KEY=VALUE header syntax", () => {
    expect(commands[0]!.lines[0]).toBe(
      'pi mcp add evergarden --url https://evergarden.example.com/mcp --header "Authorization=Bearer eg_abc"',
    );
  });
});
