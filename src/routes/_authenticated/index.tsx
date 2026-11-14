import { createFileRoute, Link } from "@tanstack/react-router";

import { DocumentRow, FolderRow } from "#/components/library/rows";
import { TopBar } from "#/components/navigation/top-bar";
import { Page, PageHeader } from "#/components/ui/page";
import { getLibrary } from "#/functions/library.functions";

export const Route = createFileRoute("/_authenticated/")({
  loader: () => getLibrary(),
  head: () => ({ meta: [{ title: "Library, evergarden" }] }),
  component: Library,
});

function Library() {
  const { latest, top } = Route.useLoaderData();
  const documents =
    top.folders.reduce((sum, entry) => sum + entry.documents, 0) + top.documents.length + top.more;

  return (
    <>
      <TopBar />
      <Page>
        <PageHeader title="Library">
          <p className="page-details">
            {documents === 1 ? "1 document" : `${documents} documents`}
          </p>
        </PageHeader>
        {documents === 0 ? (
          <p className="page-note">
            Your agents publish here. Create an API key in <Link to="/settings">settings</Link>, add
            the MCP server it shows you to your agent, and ask it to publish its next report.
          </p>
        ) : (
          <>
            <section aria-labelledby="latest-heading" className="page-section">
              <h2 id="latest-heading">Recently updated</h2>
              <ul className="rows">
                {latest.map((entry) => (
                  <DocumentRow
                    key={entry.id}
                    entry={entry}
                    place={entry.place}
                    unread={entry.unread}
                  />
                ))}
              </ul>
            </section>
            {top.folders.length > 0 ? (
              <section aria-labelledby="folders-heading" className="page-section">
                <h2 id="folders-heading">Folders</h2>
                <ul className="rows">
                  {top.folders.map((entry) => (
                    <FolderRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              </section>
            ) : null}
            {top.documents.length > 0 ? (
              <section aria-labelledby="loose-heading" className="page-section">
                <h2 id="loose-heading">Not in a folder</h2>
                <ul className="rows">
                  {top.documents.map((entry) => (
                    <DocumentRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </Page>
    </>
  );
}
