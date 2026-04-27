#!/usr/bin/env node
/**
 * Ensure website test databases are migrated before DB-backed Vitest suites run.
 * Runs core migrations only when DATABASE_URL is present and telemetry migrations
 * only when TELEMETRY_DATABASE_URL is present.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (env[key] === undefined || env[key] === "") {
      env[key] = val;
    }
  }
}

function run(scriptName) {
  const r = spawnSync("npm", ["run", scriptName], {
    cwd: websiteRoot,
    env,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

if (env.DATABASE_URL?.trim()) {
  run("db:migrate");
}
if (env.TELEMETRY_DATABASE_URL?.trim()) {
  run("db:migrate:telemetry");
}

