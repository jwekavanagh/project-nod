#!/usr/bin/env node
/**
 * Starts Next production server for agentskeptic-web, runs Playwright holistic specs, then LHCI.
 * Requires the same env keys as .github/workflows/ci.yml commercial job (plus AUTH_SECRET length).
 * Sets `NEXT_PUBLIC_APP_URL` to `productionCanonicalOrigin` from `config/primary-marketing.json`
 * so `next.config` origin parity passes under `NODE_ENV=production` even when `website/.env` pins a
 * loopback URL for local dev (Next would otherwise inject that value after an omitted key).
 * Exit: 0 ok, 1 test/assert failure, 2 missing env, 3 readiness/5xx.
 */
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const websiteDir = path.join(root, "website");
const port = 3040;
const base = `http://127.0.0.1:${port}`;

const required = [
  "DATABASE_URL",
  "TELEMETRY_DATABASE_URL",
  "AUTH_SECRET",
  "CONTACT_SALES_EMAIL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_INDIVIDUAL",
  "STRIPE_PRICE_TEAM",
  "STRIPE_PRICE_BUSINESS",
];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error("website-holistic-gate: missing env:", missing.join(", "));
  process.exit(2);
}
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error("website-holistic-gate: AUTH_SECRET must be length >= 32");
  process.exit(2);
}

const preflight = spawnSync(process.execPath, [path.join(root, "scripts", "core-database-boundary-preflight.mjs")], {
  stdio: "inherit",
});
if (preflight.status !== 0) {
  process.exit(preflight.status === null ? 1 : preflight.status);
}

const anchorsPath = path.join(root, "config", "primary-marketing.json");
const { productionCanonicalOrigin } = JSON.parse(readFileSync(anchorsPath, "utf8"));
const canonicalAppUrl = new URL(String(productionCanonicalOrigin).trim()).origin;

/** Env for `next start` / LHCI — public URL must match anchors under production `next.config`. */
const serverEnv = {
  ...process.env,
  PORT: String(port),
  NEXTAUTH_SECRET: process.env.AUTH_SECRET,
  NEXT_PUBLIC_APP_URL: canonicalAppUrl,
};

function killProcessTree(child) {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

async function httpOk(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

const child = spawn("npx", ["next", "start", "-p", String(port)], {
  cwd: websiteDir,
  env: serverEnv,
  stdio: "ignore",
  shell: true,
});

let killed = false;
function shutdown() {
  if (killed) return;
  killed = true;
  killProcessTree(child);
}

process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

for (let i = 0; i < 40; i++) {
  if (await httpOk(`${base}/`)) break;
  if (i === 39) {
    console.error("website-holistic-gate: readiness timeout waiting for GET /");
    shutdown();
    process.exit(3);
  }
  await delay(250);
}

for (const p of ["/", "/pricing", "/security"]) {
  const u = `${base}${p}`;
  try {
    const r = await fetch(u);
    if (r.status >= 500) {
      console.error("website-holistic-gate: 5xx from", u, "status", r.status);
      shutdown();
      process.exit(3);
    }
  } catch (e) {
    console.error("website-holistic-gate: fetch failed", u, e);
    shutdown();
    process.exit(3);
  }
}

const pw = spawnSync("npx", ["playwright", "test", "-c", "playwright.website-holistic.config.ts"], {
  cwd: root,
  env: { ...process.env },
  stdio: "inherit",
  shell: true,
});
if (pw.error || pw.status !== 0) {
  shutdown();
  process.exit(1);
}

const lhci = spawnSync("npx", ["lhci", "autorun", "--config=./website/lighthouserc.cjs"], {
  cwd: root,
  env: serverEnv,
  stdio: "inherit",
  shell: true,
});
shutdown();
process.exit(lhci.status === 0 ? 0 : 1);
