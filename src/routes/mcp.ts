import { requireMcpAuth } from "@better-auth/mcp";
import { createFileRoute } from "@tanstack/react-router";

import { apiKeyFrom, authorize, principalFrom, principalFromToken } from "#/server/access";
import { auth, MCP_RESOURCE } from "#/server/auth";
import { errorResponse } from "#/server/http";
import { serveMcp } from "#/server/mcp";

/**
 * Agents with an evergarden API key are served directly. Everyone else goes through OAuth: without
 * a token the answer is a 401 whose WWW-Authenticate header sends the MCP client to sign in.
 */
const withOAuth = requireMcpAuth(
  auth,
  async (request, claims) => {
    try {
      return await serveMcp(request, await principalFromToken(claims));
    } catch (error) {
      return errorResponse(error);
    }
  },
  { resource: MCP_RESOURCE },
);

async function handleMcp({ request }: { request: Request }): Promise<Response> {
  if (!apiKeyFrom(request.headers)) return withOAuth(request);
  try {
    const principal = await principalFrom(request.headers);
    authorize(principal);
    return await serveMcp(request, principal);
  } catch (error) {
    return errorResponse(error);
  }
}

export const Route = createFileRoute("/mcp")({
  server: { handlers: { GET: handleMcp, POST: handleMcp, DELETE: handleMcp } },
});
