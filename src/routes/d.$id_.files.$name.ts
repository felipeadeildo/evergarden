import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { isShown } from "#/lib/files";
import { principalFrom } from "#/server/access";
import { EvergardenError } from "#/server/errors";
import { errorResponse } from "#/server/http";
import { getDocument } from "#/server/library";
import { openFile } from "#/server/library/files";
import { guestAccess } from "#/server/sharing";

const VersionParam = z.union([z.coerce.number().int().positive(), z.literal("draft")]).optional();

/** A document's file, for whoever may read the document, at the version asked for. */
export const Route = createFileRoute("/d/$id_/files/$name")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const principal = await principalFrom(request.headers);
          const shared = await guestAccess(principal, { kind: "document", id: params.id }, "read");
          const version = VersionParam.parse(
            new URL(request.url).searchParams.get("v") ?? undefined,
          );
          if (version === "draft" && principal?.kind !== "owner") throw missing();
          if (shared?.versions === "current" && typeof version === "number") {
            const { version: current } = await getDocument(params.id);
            if (version !== current) throw missing();
          }

          const { file, body } = await openFile(params.id, params.name, version);
          const shown = isShown(file.type);
          return new Response(body, {
            headers: {
              "content-type": shown ? file.type : "application/octet-stream",
              "content-length": String(file.size),
              "content-disposition": `${shown ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
              // Nothing served here may run: not as a page, not as a script, not sniffed as one.
              "x-content-type-options": "nosniff",
              "content-security-policy": "default-src 'none'; sandbox",
              "cache-control": "private, max-age=300",
            },
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});

function missing() {
  return new EvergardenError("not_found", "No such file.");
}
