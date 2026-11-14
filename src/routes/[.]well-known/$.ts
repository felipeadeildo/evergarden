import { createFileRoute } from "@tanstack/react-router";

import { auth } from "#/server/auth";

// OAuth discovery lives at the site root (RFC 8414, RFC 9728, OpenID). Better Auth answers these
// paths from its plugins, so every /.well-known request goes to its handler.
function discovery({ request }: { request: Request }): Promise<Response> {
  return auth.handler(request);
}

export const Route = createFileRoute("/.well-known/$")({
  server: { handlers: { GET: discovery, HEAD: discovery } },
});
