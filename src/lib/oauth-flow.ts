// Better Auth signs the agent's authorize request onto the sign-in URL and adds these.
const SIGNING_PARAMS = ["sig", "exp", "ba_iat", "ba_pl", "ba_param"];

/**
 * The original authorize request, which finds a session once signed in and moves on to /connect.
 */
export function resumeAuthorizeUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has("sig") || !params.has("client_id")) return null;
  for (const name of SIGNING_PARAMS) params.delete(name);
  return `/api/auth/oauth2/authorize?${params}`;
}
