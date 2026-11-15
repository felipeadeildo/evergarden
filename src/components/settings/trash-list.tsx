import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmRow } from "#/components/settings/confirm-row";
import { DocumentIcon } from "#/components/ui/icons";
import { RelativeTime } from "#/components/ui/relative-time";
import { destroyItem, getTrash, restoreItem } from "#/functions/organize.functions";

const queryKey = ["trash"];

/** Deleted documents, kept for 30 days: restore one, or delete it for good. */
export function TrashList() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey, queryFn: () => getTrash() });
  const refresh = () => queryClient.invalidateQueries();
  const restore = useMutation({
    mutationFn: (id: string) => restoreItem({ data: { id } }),
    onSuccess: refresh,
  });
  const destroy = useMutation({
    mutationFn: (id: string) => destroyItem({ data: { id } }),
    onSuccess: refresh,
  });

  if (list.isError) return <p className="form-error">{list.error.message}</p>;
  if (!list.data || list.data.length === 0) return null;

  return (
    <section aria-labelledby="trash-heading" className="page-section">
      <h2 id="trash-heading">Trash</h2>
      <p className="page-note">Deleted documents stay here for 30 days, then go for good.</p>
      <ul className="rows">
        {list.data.map((entry) => (
          <ConfirmRow
            key={entry.id}
            icon={<DocumentIcon className="row-icon" />}
            name={entry.title}
            place={entry.deletedFrom ?? "Top of the library"}
            end={
              <>
                <RelativeTime date={new Date(entry.deletedAt)} short />
                <button
                  type="button"
                  className="row-action"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(entry.id)}
                >
                  Restore
                </button>
              </>
            }
            action="Delete forever"
            warning="Its versions and comments go too. This cannot be undone."
            confirm="Delete forever"
            onConfirm={() => destroy.mutateAsync(entry.id)}
          />
        ))}
      </ul>
    </section>
  );
}
