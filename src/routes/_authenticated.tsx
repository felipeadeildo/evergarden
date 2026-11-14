import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { SearchProvider } from "#/components/navigation/search";
import { getViewer } from "#/functions/session.functions";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const viewer = await getViewer();
    if (!viewer) throw redirect({ to: "/sign-in", search: { next: location.href } });
    return { viewer };
  },
  component: LibraryLayout,
});

function LibraryLayout() {
  const { viewer } = Route.useRouteContext();
  if (viewer.kind === "guest") return <Private name={viewer.name} />;
  return (
    <SearchProvider>
      <Outlet />
    </SearchProvider>
  );
}

function Private({ name }: { name: string }) {
  return (
    <main id="main" className="letter">
      <h1>This library is private</h1>
      <p>
        You are signed in as {name}. Only the owner can open this library; someone who shares a
        document with you sends you a link to it.
      </p>
      <button
        type="button"
        className="button"
        onClick={() => void authClient.signOut().then(() => window.location.assign("/sign-in"))}
      >
        Sign out
      </button>
    </main>
  );
}
