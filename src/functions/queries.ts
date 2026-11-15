import { queryOptions } from "@tanstack/react-query";

import { getThreads } from "./comments.functions";
import { getDocumentPage, getFolderPage, getLibrary } from "./library.functions";
import { getViewer } from "./session.functions";

// Each page's data, shared by its route's loader (which makes sure it is cached, also during
// SSR) and its component (which reads it and refreshes it once it is stale).

export const viewerQuery = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => getViewer(),
  staleTime: 5 * 60_000,
});

export const libraryQuery = queryOptions({
  queryKey: ["library"],
  queryFn: () => getLibrary(),
});

export function folderPageQuery(id: string) {
  return queryOptions({
    queryKey: ["folder-page", id],
    queryFn: () => getFolderPage({ data: { id } }),
  });
}

export function documentQuery(id: string, version?: number | "draft") {
  return queryOptions({
    queryKey: ["document", id, version ?? "current"],
    queryFn: () => getDocumentPage({ data: { id, version } }),
  });
}

export function threadsQuery(documentId: string) {
  return queryOptions({
    queryKey: ["threads", documentId],
    queryFn: () => getThreads({ data: { documentId } }),
  });
}
