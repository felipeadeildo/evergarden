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
          include: ["src/{lib,render,components}/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        plugins: [
          cloudflareTest(async () => ({
            main: "./test/worker.ts",
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations("migrations") } },
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
