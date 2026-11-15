import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import {
  acceptThreadSuggestion,
  getThreads,
  postComment,
  postReply,
  setThreadState,
} from "#/functions/comments.functions";
import type { Thread } from "#/server/comments";

export type NewComment = { start: number; end: number; body: string; suggestion?: string };

export function useThreads(documentId: string, version: number) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const key = ["threads", documentId];
  const { data: threads = [] } = useQuery({
    queryKey: key,
    queryFn: () => getThreads({ data: { documentId } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
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
  // Accepting saves a new version, so the page itself reloads too.
  const accept = useMutation({
    mutationFn: (commentId: string) => acceptThreadSuggestion({ data: { commentId } }),
    onSuccess: async () => {
      await router.invalidate();
      await refresh();
    },
  });

  return { threads, comment, reply, setState, accept };
}

export type { Thread };
