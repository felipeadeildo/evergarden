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
import { guestAccess } from "#/server/shares";

import { libraryAccess, sessionAccess } from "./middleware";

// Guests reach comments through a share link and send its token; the owner and agents need none.
const token = z.string().max(64).optional();

export const getThreads = createServerFn({ method: "GET" })
  .middleware([sessionAccess])
  .validator(z.object({ documentId: z.string(), token }))
  .handler(async ({ data, context: { principal } }) => {
    setResponseHeader("cache-control", "private, no-store");
    await guestAccess(principal, data.token, data.documentId, "comment");
    return threads(data.documentId);
  });

export const postComment = createServerFn({ method: "POST" })
  .middleware([sessionAccess])
  .validator(
    z.intersection(
      z.object({
        documentId: z.string(),
        token,
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
  .handler(async ({ data: { documentId, token: link, ...input }, context: { principal } }) => {
    await guestAccess(principal, link, documentId, "comment");
    return addComment(documentId, input, authorOf(principal!));
  });

export const postReply = createServerFn({ method: "POST" })
  .middleware([sessionAccess])
  .validator(z.object({ commentId: z.string(), body: z.string().max(10_000), token }))
  .handler(async ({ data, context: { principal } }) => {
    await guestAccess(principal, data.token, await commentDocument(data.commentId), "comment");
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
