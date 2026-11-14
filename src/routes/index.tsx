import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Library });

function Library() {
  return (
    <main id="main" className="letter">
      <h1>Your library is empty</h1>
      <p>
        Documents appear here when an agent publishes them. Create an API key in settings, add the
        MCP server to your agent, and ask it to <code>publish</code> its next report.
      </p>
    </main>
  );
}
