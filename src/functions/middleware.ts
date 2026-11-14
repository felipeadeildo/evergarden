import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { authorize, principalFrom } from "#/server/access";

/** Every server function that touches the library runs this first; route guards only shape the UI. */
export const libraryAccess = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const principal = await principalFrom(getRequestHeaders());
  authorize(principal);
  return next({ context: { principal } });
});
