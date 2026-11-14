import { useInfiniteQuery } from "@tanstack/react-query";

import { getFolder } from "#/functions/library.functions";
import type { DocumentEntry, FolderPage, FolderSummary } from "#/server/library";

export type ReadyFolder = {
  state: "ready";
  folders: FolderSummary[];
  documents: DocumentEntry[];
  /** Documents not loaded yet. */
  more: number;
  loadingMore: boolean;
  loadMore: () => void;
};

export type FolderView =
  | { state: "loading" }
  | { state: "failed"; retry: () => void }
  | ReadyFolder;

/**
 * What a folder holds, `null` being the top of the library. Loaded once per folder and shared:
 * the library tree and the folder menu in the top bar read the same cache.
 */
export function useFolder(folderId: string | null, first?: FolderPage): FolderView {
  const query = useInfiniteQuery({
    queryKey: ["folder", folderId],
    queryFn: ({ pageParam }) => getFolder({ data: { id: folderId, offset: pageParam } }),
    initialPageParam: 0,
    initialData: first ? { pages: [first], pageParams: [0] } : undefined,
    getNextPageParam: (last, pages) =>
      last.more > 0 ? pages.reduce((sum, page) => sum + page.documents.length, 0) : undefined,
  });

  if (query.isPending) return { state: "loading" };
  if (query.isError) return { state: "failed", retry: () => void query.refetch() };
  return {
    state: "ready",
    folders: query.data.pages.flatMap((page) => page.folders),
    documents: query.data.pages.flatMap((page) => page.documents),
    more: query.data.pages.at(-1)?.more ?? 0,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}
