import { createFileRoute } from "@tanstack/react-router";

import { authorize, principalFrom } from "#/server/access";
import { errorResponse } from "#/server/http";
import { serveMcp } from "#/server/mcp";

async function handleMcp({ request }: { request: Request }): Promise<Response> {
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
