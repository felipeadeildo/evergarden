import type { D1Migration } from "@cloudflare/vitest-plugin";

declare global {
  namespace Cloudflare {
    interface Env {
      /** Set only in server tests, by vitest.config.ts. */
      TEST_MIGRATIONS?: D1Migration[];
    }
  }
}
