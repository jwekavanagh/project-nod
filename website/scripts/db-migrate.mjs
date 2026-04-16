#!/usr/bin/env node
/**
 * Run drizzle-kit migrate from website root. Loads `website/.env` into the child env
 * when present so DATABASE_URL works locally; CI can rely on process.env only.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertDestructivePostgresUrlsOrExit } from "../../scripts/assert-destructive-postgres-urls.mjs";

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
const envPath = path.join(websiteRoot, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (env[key] === undefined || env[key] === "") {
      env[key] = val;
    }
  }
}

assertDestructivePostgresUrlsOrExit(
  [
    { name: "DATABASE_URL", raw: env.DATABASE_URL },
    { name: "TELEMETRY_DATABASE_URL", raw: env.TELEMETRY_DATABASE_URL },
  ],
  { tool: "db-migrate", env },
);

const preflight = path.join(websiteRoot, "..", "scripts", "core-database-boundary-preflight.mjs");
const pre = spawnSync(process.execPath, [preflight], { env, stdio: "inherit" });
if (pre.status !== 0) {
  process.exit(pre.status === null ? 1 : pre.status);
}

const drizzleKit = path.join(websiteRoot, "..", "node_modules", "drizzle-kit", "bin.cjs");
const r = spawnSync(process.execPath, [drizzleKit, "migrate"], {
  cwd: websiteRoot,
  env,
  stdio: "inherit",
});
process.exit(r.status === 0 ? 0 : r.status ?? 1);
