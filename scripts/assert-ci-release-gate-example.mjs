#!/usr/bin/env node
/**
 * Merge-gate: canonical OSS GitHub Actions example matches release-gate posture and root package version pin.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const rel = join("examples", "github-actions", "agentskeptic-check.yml");
const ymlPath = join(root, rel);

function fail(msg) {
  console.error(`[assert-ci-release-gate-example] ${msg}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const wantPin = `agentskeptic@${pkg.version}`;
if (wantPin.includes("latest")) {
  fail("package.json version must not produce agentskeptic@latest pin string");
}

const raw = readFileSync(ymlPath, "utf8");
const doc = /** @type {any} */ (parseYaml(raw));

if (doc.name !== "AgentSkeptic Truth Check") {
  fail(`workflow name must be "AgentSkeptic Truth Check", got ${JSON.stringify(doc.name)}`);
}

const job = doc.jobs?.["truth-check"];
if (!job) {
  fail("jobs.truth-check must exist");
}
if (job.name !== "AgentSkeptic Truth Check") {
  fail(`jobs.truth-check.name must be "AgentSkeptic Truth Check", got ${JSON.stringify(job.name)}`);
}
if (job["runs-on"] !== "ubuntu-latest") {
  fail(`runs-on must be ubuntu-latest, got ${JSON.stringify(job["runs-on"])}`);
}

const jenv = job.env;
if (!jenv || typeof jenv !== "object") {
  fail("truth-check.job.env must exist");
}
if (jenv.AGENTSKEPTIC_TELEMETRY !== "0") {
  fail(`jobs.truth-check.env.AGENTSKEPTIC_TELEMETRY must be string "0", got ${JSON.stringify(jenv.AGENTSKEPTIC_TELEMETRY)}`);
}
if (jenv.AGENTSKEPTIC_CI_PACKAGE !== wantPin) {
  fail(`jobs.truth-check.env.AGENTSKEPTIC_CI_PACKAGE must be exactly ${wantPin}`);
}

/** @type {any[]} */
const steps = job.steps;
if (!Array.isArray(steps)) {
  fail("truth-check.steps must be an array");
}

let setupIdx = -1;
let sqliteIdx = -1;
/** @type {number[]} */
const npmInstallSteps = [];

for (let i = 0; i < steps.length; i++) {
  const s = steps[i];
  const uses = typeof s?.uses === "string" ? s.uses : "";
  const run = typeof s?.run === "string" ? s.run : "";
  const name = typeof s?.name === "string" ? s.name : "";

  if (uses.includes("actions/setup-node")) setupIdx = i;
  if (name.includes("demo.db") && run.includes("DatabaseSync")) sqliteIdx = i;
  if (run.includes("npm install --no-save")) npmInstallSteps.push(i);
}

if (setupIdx < 0 || sqliteIdx < 0) {
  fail("must declare actions/setup-node and a demo.db SQLite seed step");
}
if (!(setupIdx < sqliteIdx)) {
  fail("actions/setup-node must appear before SQLite demo.db creation step");
}
if (npmInstallSteps.length !== 1) {
  fail(`expected exactly one npm install --no-save step, found indices ${npmInstallSteps.join(",")}`);
}

const uncommented = raw
  .split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");
const installs = [...uncommented.matchAll(/npm\s+install\s+--no-save/gi)];
if (installs.length !== 1) {
  fail(`uncommented YAML must contain exactly one npm install --no-save, count=${installs.length}`);
}

let pinOcc = 0;
const pinRe = new RegExp(wantPin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
for (const _ of raw.matchAll(pinRe)) pinOcc++;
// Single source of semver: literal pin only under job env; install + composite reuse AGENTSKEPTIC_CI_PACKAGE.
if (pinOcc !== 1) {
  fail(`literal ${wantPin} must occur exactly once in ${rel} (job env AGENTSKEPTIC_CI_PACKAGE), got ${pinOcc}`);
}

if (!/\bpackage:\s*\$\{\{\s*env\.AGENTSKEPTIC_CI_PACKAGE\s*\}\}\s*$/m.test(raw)) {
  fail("composite inputs must bind package to ${{ env.AGENTSKEPTIC_CI_PACKAGE }} (exact expression)");
}

const compositeIdx = steps.findIndex((s) => typeof s?.uses === "string" && s.uses.endsWith("agentskeptic-check"));
if (compositeIdx < 0) fail("composite agentskeptic-check step missing");
const withBlock = steps[compositeIdx]?.with ?? {};
if (withBlock.project !== ".") fail('composite with.project must be "."');
if (Object.hasOwn(withBlock, "events") || Object.hasOwn(withBlock, "registry")) {
  fail("canonical OSS example composite must omit events and registry inputs");
}

const uncommentedShare = raw.split("\n").some((line) => /^\s+share-report-origin\s*:/.test(line) && !/^\s*#/.test(line));
if (uncommentedShare) {
  fail("OSS example must not set share-report-origin uncommented");
}

console.error(`[assert-ci-release-gate-example] ok (${rel} pinned ${wantPin})`);
