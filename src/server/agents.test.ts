import { describe, expect, it } from "vitest";

import { principalFrom, principalFromToken } from "./access";
import { agentForClient, createKeyAgent, listAgents, nameOAuthAgent, revokeAgent } from "./agents";
import { db } from "./db";
import { oauthClient, user } from "./db/schema";

async function makeUser(email: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, email, name: "Felipe", emailVerified: true });
  return id;
}

async function makeClient(name: string): Promise<string> {
  const clientId = crypto.randomUUID();
  await db.insert(oauthClient).values({
    id: crypto.randomUUID(),
    clientId,
    name,
    redirectUris: ["http://127.0.0.1/callback"],
  });
  return clientId;
}

describe("agents over OAuth", () => {
  it("keeps the name the owner gave, and renames on a second approval", async () => {
    const owner = await makeUser("owner@example.com");
    const client = await makeClient("pi");
    await nameOAuthAgent(owner, client, "  pi on laptop ");
    await nameOAuthAgent(owner, client, "pi at work");
    expect(await agentForClient(owner, client)).toMatchObject({ name: "pi at work" });
    expect((await listAgents(owner)).filter((entry) => entry.method === "oauth")).toHaveLength(1);
  });

  it("signs a token's requests with the agent's name, until it is revoked", async () => {
    const owner = (await db.select().from(user).all()).find(
      (row) => row.email === "owner@example.com",
    )!.id;
    const client = await makeClient("Claude Code");
    await nameOAuthAgent(owner, client, "claude");
    const claims = { sub: owner, azp: client };
    expect(await principalFromToken(claims)).toMatchObject({ kind: "agent", name: "claude" });

    const { id } = (await agentForClient(owner, client))!;
    await revokeAgent(owner, id);
    await expect(principalFromToken(claims)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("refuses tokens issued to anyone but the owner", async () => {
    const stranger = await makeUser("stranger@example.com");
    const client = await makeClient("pi");
    await nameOAuthAgent(stranger, client, "pi");
    await expect(principalFromToken({ sub: stranger, azp: client })).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("agents with an API key", () => {
  it("creates the key and the agent together, and revoking deletes the key", async () => {
    const owner = (await db.select().from(user).all()).find(
      (row) => row.email === "owner@example.com",
    )!.id;
    const key = await createKeyAgent(owner, "ci");
    const headers = new Headers({ authorization: `Bearer ${key}` });
    expect(await principalFrom(headers)).toMatchObject({ kind: "agent", name: "ci" });

    const agent = (await listAgents(owner)).find((entry) => entry.name === "ci")!;
    expect(agent.method).toBe("key");
    await revokeAgent(owner, agent.id);
    await expect(principalFrom(headers)).rejects.toMatchObject({ code: "unauthorized" });
  });
});
