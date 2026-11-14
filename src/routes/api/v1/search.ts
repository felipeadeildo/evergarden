import { createFileRoute } from "@tanstack/react-router";

import { handle } from "#/server/http";
import { search } from "#/server/library";

export const Route = createFileRoute("/api/v1/search")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(request, () => search(new URL(request.url).searchParams.get("q") ?? "")),
    },
  },
});
