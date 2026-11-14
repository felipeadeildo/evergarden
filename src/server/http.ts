import { z } from "zod";

import { authorize, type Principal, principalFrom } from "#/server/access";
import { EvergardenError } from "#/server/errors";

/** Runs a handler for an authorised caller and turns errors into JSON with the right status. */
export async function handle(
  request: Request,
  handler: (principal: Principal) => Promise<unknown>,
): Promise<Response> {
  try {
    const principal = await principalFrom(request.headers);
    authorize(principal);
    return Response.json(await handler(principal), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof EvergardenError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return Response.json({ error: "invalid", message: z.prettifyError(error) }, { status: 400 });
  }
  console.error(error);
  return Response.json({ error: "internal", message: "Something went wrong." }, { status: 500 });
}

export async function jsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new EvergardenError("invalid", "The request body is not JSON.");
  }
  return schema.parse(body);
}

/** The public URL of a document. */
export function documentUrl(request: Request, id: string): string {
  return new URL(`/d/${id}`, request.url).href;
}
