import { useQuery, useQueryClient } from "@tanstack/react-query";

import { authClient } from "#/lib/auth-client";

export type AgentKey = {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: Date;
  lastRequest: Date | null;
};

const KEY = ["api-keys"];

/** The agents' API keys, and the two things you do with them: create one and revoke one. */
export function useAgentKeys() {
  const client = useQueryClient();
  const keys = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<AgentKey[]> => {
      const result = await authClient.apiKey.list();
      if (result.error) throw new Error(result.error.message ?? "The agents did not load.");
      return result.data.apiKeys;
    },
  });

  /** Creates a key named `name` and returns it; this is the only time its value is readable. */
  async function create(name: string): Promise<string> {
    const result = await authClient.apiKey.create({ name });
    if (result.error) throw new Error(result.error.message ?? "The key was not created.");
    await client.invalidateQueries({ queryKey: KEY });
    return result.data.key;
  }

  async function revoke(id: string): Promise<void> {
    await authClient.apiKey.delete({ keyId: id });
    await client.invalidateQueries({ queryKey: KEY });
  }

  return { keys, create, revoke };
}
