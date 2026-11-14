import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authorOf } from "#/server/access";
import { documentUrl, handle, jsonBody } from "#/server/http";
import { list, publish } from "#/server/library";

const PublishBody = z.object({
  content: z.string(),
  title: z.string().optional(),
  folder: z.string().optional(),
  repo: z.string().optional(),
});

export const Route = createFileRoute("/api/v1/documents")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(request, () => {
          const params = new URL(request.url).searchParams;
          return list({
            folder: params.get("folder") ?? undefined,
            repo: params.get("repo") ?? undefined,
          });
        }),
      POST: ({ request }) =>
        handle(request, async (principal) => {
          const result = await publish(await jsonBody(request, PublishBody), authorOf(principal));
          return { ...result, url: documentUrl(request, result.id) };
        }),
    },
  },
});
