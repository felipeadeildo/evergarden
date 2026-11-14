import { createFileRoute } from "@tanstack/react-router";

import { TopBar } from "#/components/navigation/top-bar";
import { ConnectAgent } from "#/components/settings/connect-agent";
import { ConnectedAgents } from "#/components/settings/connected-agents";
import { Page, PageHeader } from "#/components/ui/page";
import { getMcpAddress } from "#/functions/session.functions";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/_authenticated/settings")({
  loader: () => getMcpAddress(),
  head: () => ({ meta: [{ title: "Settings, evergarden" }] }),
  component: Settings,
});

function Settings() {
  const { viewer } = Route.useRouteContext();
  const mcpAddress = Route.useLoaderData();

  return (
    <>
      <TopBar />
      <Page>
        <PageHeader title="Settings" />
        <section aria-labelledby="connect-heading" className="page-section">
          <h2 id="connect-heading">Connect an agent</h2>
          <p className="page-note">
            Agents publish here over MCP. Each one signs what it writes with the name you give it.
          </p>
          <ConnectAgent server={mcpAddress} />
        </section>
        <section aria-labelledby="agents-heading" className="page-section">
          <h2 id="agents-heading">Connected agents</h2>
          <ConnectedAgents />
        </section>
        <p className="page-note signed-in">
          Signed in as {viewer.name}, {viewer.email}.{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => void authClient.signOut().then(() => window.location.assign("/sign-in"))}
          >
            Sign out
          </button>
        </p>
      </Page>
    </>
  );
}
