import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";

import { principalFrom } from "#/server/access";

export type Viewer = { kind: "owner" | "guest"; name: string };

/** The signed-in person, or null. Shapes the UI only; server functions check access themselves. */
export const getViewer = createServerFn({ method: "GET" }).handler(
  async (): Promise<Viewer | null> => {
    const principal = await principalFrom(getRequestHeaders());
    if (!principal || principal.kind === "agent") return null;
    return { kind: principal.kind, name: principal.name };
  },
);

export const getSignInMethods = createServerFn({ method: "GET" }).handler(() => ({
  github: Boolean(env.GITHUB_CLIENT_ID),
  google: Boolean(env.GOOGLE_CLIENT_ID),
  password: import.meta.env.DEV,
}));
