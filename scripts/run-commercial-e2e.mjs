#!/usr/bin/env node
/**
 * Layer 2 orchestration (local): docker compose (Postgres + Mailpit), Drizzle migrate,
 * Next.js start, stripe listen (manual in another terminal), Playwright.
 *
 * Prerequisites: Docker, Stripe CLI, Playwright browsers (`npx playwright install chromium`).
 *
 * Example:
 *   docker compose -f docker-compose.commercial-e2e.yml up -d
 *   set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/wfv_commercial
 *   cd website && npx drizzle-kit migrate && npm run build && npm run start
 *   stripe listen --forward-to http://127.0.0.1:3000/api/webhooks/stripe
 *   set STRIPE_WEBHOOK_SECRET=whsec_...
 *   set E2E_COMMERCIAL_FUNNEL=1
 *   set AUTH_SECRET=...
 *   npx playwright test -c playwright.commercial.config.ts
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const compose = spawnSync(
  "docker",
  ["compose", "-f", "docker-compose.commercial-e2e.yml", "up", "-d"],
  { cwd: root, stdio: "inherit" },
);
if (compose.status !== 0) {
  console.error("run-commercial-e2e: docker compose failed");
  process.exit(1);
}

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5433/wfv_commercial";

const mig = spawnSync("npx", ["drizzle-kit", "migrate"], {
  cwd: path.join(root, "website"),
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: dbUrl },
});
if (mig.status !== 0) {
  console.error("run-commercial-e2e: drizzle-kit migrate failed");
  process.exit(1);
}

console.log(`
run-commercial-e2e: infrastructure is up.
Next: build/start website with DATABASE_URL, AUTH_SECRET, E2E_COMMERCIAL_FUNNEL=1,
STRIPE_* and STRIPE_WEBHOOK_SECRET from \`stripe listen\`, then:
  COMMERCIAL_E2E_FULL=1 npx playwright test -c playwright.commercial.config.ts
`);
