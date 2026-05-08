import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    // Integration suites TRUNCATE shared tables; parallel files race and drop each other's rows (flaky 404 vs 500).
    fileParallelism: false,
    /**
     * Fork pool default uses multiple workers. Each file using `ensureMarketingSiteRunning` runs a heavy
     * sync + Next build sequence; overlapping files across workers can exhaust CI (and looks like hangs).
     * Keep one Vitest worker so marketing-site harness work never runs concurrently.
     */
    maxWorkers: 1,
    /** `ensureMarketingSiteRunning` runs preflight + sync + `next build` + `next start` + readiness poll (up to ~75s) — can exceed 3m on slow CI. */
    hookTimeout: 300_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
