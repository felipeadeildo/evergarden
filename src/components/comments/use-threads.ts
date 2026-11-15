import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  acceptThreadSuggestion,
  postComment,
  postReply,
  setThreadState,
} from "#/functions/comments.functions";
import { threadsQuery } from "#/functions/queries";
import type { Thread } from "#/server/comments";

export type NewComment = { start: number; end: number; body: string; suggestion?: string };

export function useThreads(documentId: string, version: number) {
  const queryClient = useQueryClient();
  const { queryKey } = threadsQuery(documentId);
  const { data: threads } = useSuspenseQuery(threadsQuery(documentId));

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const done = { onSuccess: refresh };

  const comment = useMutation({
    mutationFn: (input: NewComment) =>
      postComment({ data: { documentId, version, kind: "text", ...input } }),
    ...done,
  });
  const reply = useMutation({
    mutationFn: (input: { commentId: string; body: string }) => postReply({ data: input }),
    ...done,
  });
  const setState = useMutation({
    mutationFn: (input: { commentId: string; state: "open" | "resolved" }) =>
      setThreadState({ data: input }),
    ...done,
  });
  // Accepting saves a new version, so the document refreshes too.
  const accept = useMutation({
    mutationFn: (commentId: string) => acceptThreadSuggestion({ data: { commentId } }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
        refresh(),
      ]),
  });

  return { threads, comment, reply, setState, accept };
}

export type { Thread };
