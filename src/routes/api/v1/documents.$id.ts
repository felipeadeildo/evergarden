import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authorOf } from "#/server/access";
import { documentUrl, handle, jsonBody } from "#/server/http";
import { read, update } from "#/server/library";

const UpdateBody = z.object({
  content: z.string(),
  baseVersion: z.int().positive().optional(),
});

const VersionParam = z.coerce.number().int().positive().optional();

export const Route = createFileRoute("/api/v1/documents/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handle(request, async () => {
          const version = VersionParam.parse(
            new URL(request.url).searchParams.get("version") ?? undefined,
          );
          const result = await read(params.id, version);
          return {
            id: result.document.id,
            title: result.document.title,
            version: result.version.number,
            currentVersion: result.document.version,
            updatedAt: result.version.createdAt,
            updatedBy: result.version.authorName,
            url: documentUrl(request, params.id),
            content: result.source,
          };
        }),
      PUT: ({ request, params }) =>
        handle(request, async (principal) => {
          const result = await update(
            params.id,
            await jsonBody(request, UpdateBody),
            authorOf(principal),
          );
          return { ...result, url: documentUrl(request, params.id) };
        }),
    },
  },
});
