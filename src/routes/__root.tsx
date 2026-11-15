import literataItalic from "@fontsource-variable/literata/files/literata-latin-opsz-italic.woff2?url";
import literata from "@fontsource-variable/literata/files/literata-latin-opsz-normal.woff2?url";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Link, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "#/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F6F5F0", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#10151E", media: "(prefers-color-scheme: dark)" },
      { title: "evergarden" },
    ],
    links: [
      // Discovered only after the stylesheet otherwise, which leaves the first paint in the fallback.
      ...[literata, literataItalic].map((href) => ({
        rel: "preload",
        href,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      })),
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main id="main" className="letter">
      <h1>Nothing here</h1>
      <p>
        This address has no document. It may have been deleted, or the link was copied wrong.{" "}
        <Link to="/">Open the library</Link>
      </p>
    </main>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
