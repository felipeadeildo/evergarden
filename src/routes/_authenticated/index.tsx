import { createFileRoute, Link } from "@tanstack/react-router";

import { DocumentRow, FolderRow } from "#/components/library/rows";
import { TopBar } from "#/components/navigation/top-bar";
import { getLibrary } from "#/functions/library.functions";

export const Route = createFileRoute("/_authenticated/")({
  loader: () => getLibrary(),
  head: () => ({ meta: [{ title: "Library, evergarden" }] }),
  component: Library,
});

function Library() {
  const { latest, top } = Route.useLoaderData();

  if (latest.length === 0) {
    return (
      <>
        <TopBar />
        <main id="main" className="library">
          <section className="empty">
            <h1>No documents yet</h1>
            <p>
              Your agents publish here. Create an API key in <Link to="/settings">settings</Link>,
              add the MCP server it shows you to your agent, and ask it to publish its next report.
            </p>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main id="main" className="library">
        <section aria-labelledby="latest-heading" className="library-section">
          <h1 id="latest-heading" className="library-heading">
            Recently updated
          </h1>
          <ul className="rows">
            {latest.map((entry) => (
              <DocumentRow key={entry.id} entry={entry} place={entry.place} unread={entry.unread} />
            ))}
          </ul>
        </section>
        {top.folders.length > 0 ? (
          <section aria-labelledby="folders-heading" className="library-section">
            <h2 id="folders-heading" className="library-heading">
              Folders
            </h2>
            <ul className="rows">
              {top.folders.map((entry) => (
                <FolderRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </section>
        ) : null}
        {top.documents.length > 0 ? (
          <section aria-labelledby="loose-heading" className="library-section">
            <h2 id="loose-heading" className="library-heading">
              Not in a folder
            </h2>
            <ul className="rows">
              {top.documents.map((entry) => (
                <DocumentRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
