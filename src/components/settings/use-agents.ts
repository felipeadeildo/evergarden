import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createAgentKey, getAgents, revokeAgentAccess } from "#/functions/agents.functions";

const KEY = ["agents"];

/** The agents connected to the library, and the two things you do with them in settings. */
export function useAgents() {
  const client = useQueryClient();
  const agents = useQuery({ queryKey: KEY, queryFn: () => getAgents() });

  /** Creates a key-holding agent and returns the key; this is the only time it is readable. */
  async function createKey(name: string): Promise<string> {
    const key = await createAgentKey({ data: { name } });
    await client.invalidateQueries({ queryKey: KEY });
    return key;
  }

  async function revoke(id: string): Promise<void> {
    await revokeAgentAccess({ data: { id } });
    await client.invalidateQueries({ queryKey: KEY });
  }

  return { agents, createKey, revoke };
}
