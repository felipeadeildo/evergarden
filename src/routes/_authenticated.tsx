import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { Private } from "#/components/navigation/private";
import { SearchProvider } from "#/components/navigation/search";

/** The owner's library: the home page and settings. Documents and folders decide for themselves. */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location, context: { viewer } }) => {
    if (!viewer) throw redirect({ to: "/sign-in", search: { next: location.href } });
    return { viewer };
  },
  component: LibraryLayout,
});

function LibraryLayout() {
  const { viewer } = Route.useRouteContext();
  if (viewer.kind === "guest") return <Private email={viewer.email} />;
  return (
    <SearchProvider>
      <Outlet />
    </SearchProvider>
  );
}
