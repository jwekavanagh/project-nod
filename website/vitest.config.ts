import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    // Integration suites TRUNCATE shared tables; parallel files race and drop each other's rows (flaky 404 vs 500).
    fileParallelism: false,
    /** `ensureMarketingSiteRunning` runs sync + optional `next build` + `next start` + readiness poll — exceeds Vitest’s default 10s hook limit on CI. */
    hookTimeout: 180_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
