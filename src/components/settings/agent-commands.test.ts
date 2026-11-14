import { describe, expect, it } from "vitest";

import { agentCommands } from "./agent-commands";

const SERVER = "https://evergarden.example.com/mcp";

describe("agentCommands", () => {
  it("adds the server without a secret when agents sign in over OAuth", () => {
    for (const { lines } of agentCommands(SERVER)) {
      const all = lines.join("\n");
      expect(all).toContain(SERVER);
      expect(all).not.toContain("Bearer");
    }
    expect(agentCommands(SERVER)[0]!.lines).toEqual([
      `pi mcp add evergarden --url ${SERVER}`,
      "pi mcp login evergarden",
    ]);
  });

  it("puts the key in every client's command when there is one", () => {
    for (const { lines } of agentCommands(SERVER, "eg_abc")) {
      expect(lines.join("\n")).toContain("eg_abc");
    }
    expect(agentCommands(SERVER, "eg_abc")[0]!.lines[0]).toBe(
      `pi mcp add evergarden --url ${SERVER} --header "Authorization=Bearer eg_abc"`,
    );
  });
});
