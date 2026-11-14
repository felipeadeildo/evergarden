import { createFileRoute, Link } from "@tanstack/react-router";

import { DocumentRow, LibraryTree } from "#/components/library/tree";
import { TopBar } from "#/components/navigation/top-bar";
import { getLibrary } from "#/functions/library.functions";

export const Route = createFileRoute("/_authenticated/")({
  loader: () => getLibrary(),
  head: () => ({ meta: [{ title: "Library, evergarden" }] }),
  component: Library,
});

function Library() {
  const { root, unread } = Route.useLoaderData();
  const empty = root.folders.length === 0 && root.documents.length === 0;

  return (
    <>
      <TopBar />
      <main id="main" className="library">
        {empty ? (
          <section className="empty">
            <h1>No documents yet</h1>
            <p>
              Your agents publish here. Create an API key in <Link to="/settings">settings</Link>,
              add the MCP server it shows you to your agent, and ask it to publish its next report.
            </p>
          </section>
        ) : (
          <>
            {unread.length > 0 ? (
              <section aria-labelledby="unread-heading" className="library-section">
                <h1 id="unread-heading" className="library-heading">
                  New for you
                </h1>
                <ul className="tree">
                  {unread.map((entry) => (
                    <DocumentRow key={entry.id} entry={entry} place={entry.place} />
                  ))}
                </ul>
              </section>
            ) : null}
            <section aria-labelledby="all-heading" className="library-section">
              <h2 id="all-heading" className="library-heading">
                Everything
              </h2>
              <LibraryTree root={root} />
            </section>
          </>
        )}
      </main>
    </>
  );
}
