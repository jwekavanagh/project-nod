#!/usr/bin/env node
/**
 * Layer 1 commercial validation + optional Layer 2 (Playwright).
 * Writes artifacts/commercial-validation-verdict.json
 */
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = path.join(root, "artifacts");
const verdictPath = path.join(artifactDir, "commercial-validation-verdict.json");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    stdio: "inherit",
    shell: opts.shell ?? false,
    env: { ...process.env, ...opts.env },
  });
  return r.status === 0;
}

function gitHead() {
  try {
    return execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const layers = { regression: false, funnel: false };

if (!run(process.execPath, ["scripts/check-commercial-plans-ssot.mjs"])) {
  writeVerdict("not_solved", layers);
  process.exit(1);
}

if (!run("npm", ["run", "build"], { shell: true })) {
  writeVerdict("not_solved", layers);
  process.exit(1);
}

if (!run("npx", ["vitest", "run", "src/commercial/licensePreflight.test.ts"], { shell: true })) {
  writeVerdict("not_solved", layers);
  process.exit(1);
}

layers.regression = true;

if (
  !run("npx", ["vitest", "run"], {
    cwd: path.join(root, "website"),
    shell: true,
  })
) {
  writeVerdict("not_solved", layers);
  process.exit(1);
}

if (process.env.COMMERCIAL_PACK_SMOKE === "1") {
  if (
    !run(process.execPath, ["scripts/pack-smoke-commercial.mjs"], {
      env: {
        ...process.env,
        COMMERCIAL_LICENSE_API_BASE_URL:
          process.env.COMMERCIAL_LICENSE_API_BASE_URL ?? "https://pack-smoke.example.com",
      },
    })
  ) {
    writeVerdict("not_solved", layers);
    process.exit(1);
  }
}

if (process.env.COMMERCIAL_VALIDATE_PLAYWRIGHT === "1") {
  const pw = run("npx", ["playwright", "test", "-c", "playwright.commercial.config.ts"], {
    shell: true,
    env: process.env,
  });
  if (!pw) {
    writeVerdict("not_solved", layers);
    process.exit(1);
  }
  layers.funnel = true;
} else {
  layers.funnel = false;
}

const solved =
  layers.regression &&
  (process.env.COMMERCIAL_REQUIRE_LAYER2 === "1" ? layers.funnel : true);

writeVerdict(solved ? "solved" : "not_solved", layers);
process.exit(solved ? 0 : 1);

function writeVerdict(status, lyr) {
  mkdirSync(artifactDir, { recursive: true });
  const body = {
    schemaVersion: 1,
    status,
    provenBy: "validate-commercial-funnel.mjs",
    layers: lyr,
    commit: gitHead(),
    recordedAt: new Date().toISOString(),
  };
  writeFileSync(verdictPath, JSON.stringify(body, null, 2) + "\n", "utf8");
}
