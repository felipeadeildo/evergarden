import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Pure modules run in Node; server modules run in workerd with local D1 and R2.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/{lib,render,anchor,components}/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        plugins: [
          cloudflareTest(async () => ({
            main: "./test/worker.ts",
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations("migrations"),
                // Fixed values, so tests behave the same with or without a local .dev.vars.
                OWNER_EMAIL: "owner@example.com",
                BETTER_AUTH_SECRET: "test-secret-for-vitest-only-0123456789",
                BETTER_AUTH_URL: "http://localhost:3000",
              },
            },
          })),
        ],
        test: {
          name: "workers",
          include: ["src/server/**/*.test.ts"],
          setupFiles: ["./test/setup.ts"],
        },
      },
    ],
  },
});
