#!/usr/bin/env node
/**
 * Canonical merge gate: regeneration + git diff, structural checks, Postgres distribution,
 * then full CI journey suite (formerly verify.mjs --profile=ci + merged commercial job).
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { runRepoPolicyAndApiGuards } from "./repo-policy-and-api-guards.mjs";
import { phases, profileCiTail } from "./verification-truth-stages.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const MANIFEST = join(root, "schemas", "ci", "verification-truth.manifest.json");
const MANIFEST_SCHEMA = join(root, "schemas", "ci", "verification-truth.manifest.schema.json");

function loadManifest() {
  const body = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const schema = JSON.parse(readFileSync(MANIFEST_SCHEMA, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(body)) {
    console.error("[verification-truth:gating] manifest failed JSON Schema validation", validate.errors);
    process.exit(1);
  }
  return body;
}

function runShell(cmd, label) {
  console.error(`[${label}] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, cwd: root, shell: true });
}

function runRegeneration(manifest) {
  for (const step of manifest.regeneration.scripts) {
    const cwd = step.cwd === "website" ? join(root, "website") : root;
    const cmd = `npm run ${step.npmScript}`;
    console.error(`[verification-truth:gating] ${cmd} (cwd=${step.cwd})`);
    execSync(cmd, { stdio: "inherit", env: process.env, cwd, shell: true });
  }
}

function runGitDiffGate(manifest) {
  const paths = manifest.gating.gitPathspecs;
  const r = spawnSync("git", ["diff", "--exit-code", "HEAD", "--", ...paths], {
    encoding: "utf8",
    cwd: root,
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(
      "[verification-truth:gating] git diff: committed files differ from regenerated outputs. " +
        "Run `npm run sync-website-ssot` from repo root after editing marketing/config, then `npm run codegen:types` as needed. " +
        "Remediation: `npm run verification:truth` after fixing sources.",
    );
    spawnSync("git", ["diff", "--stat", "HEAD", "--", ...paths], {
      stdio: "inherit",
      cwd: root,
      env: process.env,
    });
    spawnSync("git", ["diff", "HEAD", "--", ...paths], { stdio: "inherit", cwd: root, env: process.env });
    process.exit(1);
  }
}

function runStructuralAfterDiff() {
  runShell("node scripts/contract-manifest.mjs --check", "verification-truth:gating");
  runShell("npm run check:epistemic-contract-structure", "verification-truth:gating");
  console.error("[verification-truth:guards] repo policy + API surface");
  runRepoPolicyAndApiGuards();
}

function runPostgresDistributionBlock() {
  const label = "verification-truth:postgres";
  const prevWrites = process.env.AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB;
  process.env.AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB = "1";
  try {
    runShell("node scripts/ci-create-website-telemetry-dbs.mjs", label);
    runShell("npx playwright install chromium", label);
    runShell("npm run validate-commercial", label);
    runShell("npm run verify:web-marketing-copy", label);
  } finally {
    if (prevWrites === undefined) {
      delete process.env.AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB;
    } else {
      process.env.AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB = prevWrites;
    }
  }
}

function runJourneyTail() {
  for (const id of profileCiTail) {
    const fn = phases[id];
    if (!fn) {
      console.error(`[verification-truth:journeys] internal error: unknown stage ${id}`);
      process.exit(2);
    }
    fn();
  }
}

function requirePostgresEnv() {
  if (!process.env.DATABASE_URL?.trim() || !process.env.TELEMETRY_DATABASE_URL?.trim()) {
    console.error(
      "[verification-truth:postgres] DATABASE_URL and TELEMETRY_DATABASE_URL must be set (website/.env.example). " +
        "Commercial validation and downstream journeys require Postgres.",
    );
    process.exit(1);
  }
}

function main() {
  requirePostgresEnv();
  const manifest = loadManifest();
  runRegeneration(manifest);
  runGitDiffGate(manifest);
  runStructuralAfterDiff();
  runPostgresDistributionBlock();
  runJourneyTail();
}

main();
