#!/usr/bin/env node
/**
 * Canonical merge gate: regeneration + git diff, structural checks, Postgres distribution,
 * then full CI journey suite (formerly verify.mjs --profile=ci + merged commercial job).
 */
import { spawnSync } from "node:child_process";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { runRepoPolicyAndApiGuards } from "./repo-policy-and-api-guards.mjs";
import { CLOSED_DRIFT_ARTIFACT_REL_PATHS } from "./enumerate-drift-artifacts.mjs";
import { phases, profileCiTail } from "./verification-truth-stages.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const MANIFEST = join(root, "schemas", "ci", "verification-truth.manifest.json");
const MANIFEST_SCHEMA = join(root, "schemas", "ci", "verification-truth.manifest.schema.json");

class VerificationTruthExit extends Error {
  /** @param {number} code */
  constructor(code) {
    super(`_VT_${code}`);
    this.code = code;
  }
}

/** @param {number} code @param {string} [stderr] */
function vtExit(code, stderr) {
  if (stderr) console.error(stderr);
  throw new VerificationTruthExit(code);
}

/** @typedef {{ regeneration: number, preflightDriftRoster: number, gitDiffGate: number, structuralGuards: number, postgresDistribution: number, journeyTail: number }} PhaseTimings */

/** @returns {PhaseTimings} */
function zeroTimings() {
  return {
    regeneration: 0,
    preflightDriftRoster: 0,
    gitDiffGate: 0,
    structuralGuards: 0,
    postgresDistribution: 0,
    journeyTail: 0,
  };
}

/** @param {PhaseTimings} timings @param {keyof PhaseTimings} key @param {() => void} fn */
function timeBlock(timings, key, fn) {
  const a = performance.now();
  fn();
  timings[key] += Math.round(performance.now() - a);
}

function loadManifest() {
  const body = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const schema = JSON.parse(readFileSync(MANIFEST_SCHEMA, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(body)) {
    console.error("[verification-truth:gating] manifest failed JSON Schema validation", validate.errors);
    vtExit(1);
  }
  return body;
}

function assertClosedDriftRosterMatches(body) {
  const want = [...CLOSED_DRIFT_ARTIFACT_REL_PATHS];
  const got = body.gating?.closedDriftPaths;
  if (!Array.isArray(got) || got.length !== want.length || got.some((p, i) => p !== want[i])) {
    console.error(
      "[verification-truth:gating] schemas/ci/verification-truth.manifest.json gating.closedDriftPaths " +
        "must equal scripts/enumerate-drift-artifacts.mjs CLOSED_DRIFT_ARTIFACT_REL_PATHS (sorted).",
    );
    vtExit(1);
  }
}

function runShell(cmd, label) {
  console.error(`[${label}] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, cwd: root, shell: true });
}

/** @param {unknown} manifest */
function runRegeneration(manifest) {
  for (const step of manifest.regeneration.scripts) {
    const cwd = step.cwd === "website" ? join(root, "website") : root;
    const cmd = `npm run ${step.npmScript}`;
    console.error(`[verification-truth:gating] ${cmd} (cwd=${step.cwd})`);
    execSync(cmd, { stdio: "inherit", env: process.env, cwd, shell: true });
  }
}

/** @param {unknown} manifest */
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
    vtExit(1);
  }
}

function runStructuralAfterDiff() {
  runShell("npm run check:buyer-truth", "verification-truth:gating");
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
      vtExit(2);
    }
    fn();
  }
  return profileCiTail.length ? profileCiTail[profileCiTail.length - 1] : null;
}

function requirePostgresEnv() {
  if (!process.env.DATABASE_URL?.trim() || !process.env.TELEMETRY_DATABASE_URL?.trim()) {
    console.error(
      "[verification-truth:postgres] DATABASE_URL and TELEMETRY_DATABASE_URL must be set (website/.env.example). " +
        "Commercial validation and downstream journeys require Postgres.",
    );
    vtExit(1);
  }
}

async function main() {
  /** @type {PhaseTimings} */
  const timings = zeroTimings();
  let exitCode = 0;
  /** @type {string | null} */
  let verificationTruthExitPhase = null;
  /** @type {unknown | undefined} */
  let manifest;
  try {
    timeBlock(timings, "preflightDriftRoster", () => {
      requirePostgresEnv();
      manifest = loadManifest();
      assertClosedDriftRosterMatches(manifest);
    });
    timeBlock(timings, "regeneration", () => {
      runRegeneration(manifest);
    });
    timeBlock(timings, "gitDiffGate", () => {
      runGitDiffGate(manifest);
    });
    timeBlock(timings, "structuralGuards", () => {
      runStructuralAfterDiff();
    });
    timeBlock(timings, "postgresDistribution", () => {
      runPostgresDistributionBlock();
    });
    timeBlock(timings, "journeyTail", () => {
      verificationTruthExitPhase = runJourneyTail();
    });
  } catch (e) {
    if (e instanceof VerificationTruthExit) {
      exitCode = e.code;
    } else {
      console.error("[verification-truth] unexpected error:", e);
      exitCode = 1;
    }
    if (verificationTruthExitPhase === null) {
      verificationTruthExitPhase = "before_or_during_gate";
    }
  }

  /** @type {(args: Parameters<typeof import("../src/mergeGateReceiptFinalize.js")["finalizeMergeGateReceipt"]>[0]) => void} */
  let finalizeMergeGateReceipt;
  try {
    const mod = await import(pathToFileURL(join(root, "dist", "mergeGateReceiptFinalize.js")).href);
    finalizeMergeGateReceipt = mod.finalizeMergeGateReceipt;
  } catch (e) {
    console.error(
      "[verification-truth:merge-gate-receipt] failed to import dist/mergeGateReceiptFinalize.js — run `npm run build` first:",
      e,
    );
    process.exit(3);
  }

  const outcome =
    exitCode === 0 ? "success" : exitCode === 1 || exitCode === 2 ? "failure" : "operational_abort";
  try {
    finalizeMergeGateReceipt({
      exitCode,
      outcome,
      packageRoot: root,
      timings,
      verificationTruthExitPhase:
        verificationTruthExitPhase ??
        (exitCode === 0 ? (profileCiTail.length ? profileCiTail[profileCiTail.length - 1] : "done") : "aborted"),
    });
  } catch (e) {
    console.error("[verification-truth] merge gate receipt finalize error:", e);
    process.exit(3);
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
