#!/usr/bin/env node
/**
 * Ensures website/.env exists before `verification:truth:local` runs dotenv-cli.
 * dotenv-cli does not fail when -e path is missing, which would otherwise
 * re-trigger the DATABASE_URL missing message and look like "gate unavailable".
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, "website", ".env");

if (!existsSync(envFile)) {
  console.error(
    "[verification-truth:local] Missing website/.env (gitignored).\n" +
      "Copy website/.env.example to website/.env and set DATABASE_URL and TELEMETRY_DATABASE_URL for local Postgres.\n" +
      "Do not create a repo-root .env for this gate; use: npm run verification:truth:local",
  );
  process.exit(1);
}
