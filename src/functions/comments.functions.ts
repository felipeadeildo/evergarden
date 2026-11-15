import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { authorOf } from "#/server/access";
import {
  acceptSuggestion,
  addComment,
  addReply,
  commentDocument,
  reopen,
  resolve,
  threads,
} from "#/server/comments";
import { getDocument } from "#/server/library";
import { guestAccess } from "#/server/sharing";

import { libraryAccess, sessionAccess } from "./middleware";

export const getThreads = createServerFn({ method: "GET" })
  .middleware([sessionAccess])
  .validator(z.object({ documentId: z.string() }))
  .handler(async ({ data, context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    const shared = await guestAccess(
      principal,
      { kind: "document", id: data.documentId },
      "comment",
    );
    if (shared?.versions !== "current") return threads(data.documentId);
    // What was resolved on a version the guest cannot open stays with that version.
    const [all, { version }] = await Promise.all([
      threads(data.documentId),
      getDocument(data.documentId),
    ]);
    return all.filter((thread) => thread.status !== "resolved" || thread.version === version);
  });

export const postComment = createServerFn({ method: "POST" })
  .middleware([sessionAccess])
  .validator(
    z.intersection(
      z.object({
        documentId: z.string(),
        version: z.int().positive(),
        start: z.int().nonnegative(),
        end: z.int().positive(),
        body: z.string().max(10_000),
        suggestion: z.string().max(100_000).optional(),
      }),
      z.discriminatedUnion("kind", [
        z.object({ kind: z.enum(["text", "block"]) }),
        z.object({
          kind: z.literal("point"),
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
        }),
      ]),
    ),
  )
  .handler(async ({ data: { documentId, ...input }, context: { principal } }) => {
    await guestAccess(principal, { kind: "document", id: documentId }, "comment");
    return addComment(documentId, input, authorOf(principal!));
  });

export const postReply = createServerFn({ method: "POST" })
  .middleware([sessionAccess])
  .validator(z.object({ commentId: z.string(), body: z.string().max(10_000) }))
  .handler(async ({ data, context: { principal } }) => {
    const documentId = await commentDocument(data.commentId);
    await guestAccess(principal, { kind: "document", id: documentId }, "comment");
    return addReply(data.commentId, data.body, authorOf(principal!));
  });

export const setThreadState = createServerFn({ method: "POST" })
  .middleware([libraryAccess])
  .validator(z.object({ commentId: z.string(), state: z.enum(["resolved", "open"]) }))
  .handler(({ data, context: { principal } }) =>
    data.state === "resolved"
      ? resolve(data.commentId, authorOf(principal))
      : reopen(data.commentId),
  );

export const acceptThreadSuggestion = createServerFn({ method: "POST" })
  .middleware([libraryAccess])
  .validator(z.object({ commentId: z.string() }))
  .handler(({ data, context: { principal } }) =>
    acceptSuggestion(data.commentId, authorOf(principal)),
  );
