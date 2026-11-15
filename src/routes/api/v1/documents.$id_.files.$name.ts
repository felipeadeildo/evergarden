import { createFileRoute } from "@tanstack/react-router";

import { formatSize, MAX_FILE_BYTES } from "#/lib/files";
import { authorOf } from "#/server/access";
import { EvergardenError } from "#/server/errors";
import { documentUrl, handle } from "#/server/http";
import { attachFile, detachFile } from "#/server/library/files";

/** Puts a file in the document's draft, or takes it out; `publish_draft` makes it a version. */
export const Route = createFileRoute("/api/v1/documents/$id_/files/$name")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        handle(request, async (principal) => {
          // Refuse before reading the body when its size is announced.
          if (Number(request.headers.get("content-length")) > MAX_FILE_BYTES) {
            throw new EvergardenError(
              "too_large",
              `Files are at most ${formatSize(MAX_FILE_BYTES)}.`,
            );
          }
          const draft = await attachFile(
            params.id,
            params.name,
            await request.arrayBuffer(),
            authorOf(principal),
          );
          return { files: draft.files, url: documentUrl(request, params.id) };
        }),
      DELETE: ({ request, params }) =>
        handle(request, async (principal) => {
          const draft = await detachFile(params.id, params.name, authorOf(principal));
          return { files: draft.files, url: documentUrl(request, params.id) };
        }),
    },
  },
});
