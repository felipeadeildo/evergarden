import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, getRequestUrl } from "@tanstack/react-start/server";

import { principalFrom } from "#/server/access";

export type Viewer = { kind: "owner" | "guest"; name: string; email: string };

/** The signed-in person, or null. Shapes the UI only; server functions check access themselves. */
export const getViewer = createServerFn({ method: "GET" }).handler(
  async (): Promise<Viewer | null> => {
    const principal = await principalFrom(getRequestHeaders());
    if (!principal || principal.kind === "agent") return null;
    return { kind: principal.kind, name: principal.name, email: principal.email };
  },
);

/** The address agents connect to: this deployment's /mcp, as the browser reached it. */
export const getMcpAddress = createServerFn({ method: "GET" }).handler(
  () => new URL("/mcp", getRequestUrl()).href,
);
