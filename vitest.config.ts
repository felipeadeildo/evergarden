import { defineConfig } from "vitest/config";

// Unit tests cover the pure modules (render, anchor) and run in Node, without the Workers runtime.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
