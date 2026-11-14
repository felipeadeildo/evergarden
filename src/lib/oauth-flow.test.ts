import { describe, expect, it } from "vitest";

import { resumeAuthorizeUrl } from "./oauth-flow";

describe("resumeAuthorizeUrl", () => {
  it("rebuilds the authorize request without the signature", () => {
    const search =
      "?response_type=code&client_id=abc&redirect_uri=http%3A%2F%2F127.0.0.1%3A5555%2Fcallback" +
      "&state=s&exp=1&ba_iat=2&ba_param=client_id&ba_param=state&sig=xyz";
    const url = new URL(resumeAuthorizeUrl(search)!, "http://localhost");
    expect(url.pathname).toBe("/api/auth/oauth2/authorize");
    expect([...url.searchParams.keys()]).toEqual([
      "response_type",
      "client_id",
      "redirect_uri",
      "state",
    ]);
  });

  it("is null for an ordinary sign-in", () => {
    expect(resumeAuthorizeUrl("?next=%2Fsettings")).toBeNull();
  });
});
