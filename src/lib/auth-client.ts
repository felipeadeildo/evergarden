import { apiKeyClient } from "@better-auth/api-key/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// oauthProviderClient carries an agent's OAuth request through sign-in and /connect.
export const authClient = createAuthClient({
  plugins: [apiKeyClient(), emailOTPClient(), oauthProviderClient()],
});
