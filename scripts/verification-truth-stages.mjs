#!/usr/bin/env node
/**
 * Executable stage functions for verification-truth (formerly scripts/verify.mjs).
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  sqliteNodeTestFiles,
  postgresNodeTestFiles,
} from "../test/suites.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const websiteTestsDir = join(root, "website", "__tests__");

export const CI_WORKFLOW_TRUTH_SINGLE = "test/ci-workflow-truth-postgres-contract.test.mjs";

/** @param {string} file basename under website/__tests__ */
export function websiteVitestIncludeArgs(modulesFile) {
  const list = JSON.parse(readFileSync(join(websiteTestsDir, modulesFile), "utf8"));
  return list.map((s) => s.replace(/^\.\//, "__tests__/"));
}

export function run(cmd) {
  console.error(`[verification-truth:journeys] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, cwd: root, shell: true });
}

export const phases = {
  build: () => run("npm run build"),
  checkLanggraphEmbeds: () => run("npm run check:langgraph-embeds"),
  epistemic: () => run("npm run check:epistemic-contract-structure"),
  vitestRoot: () => run("npm run test:vitest"),
  vitestWebsiteCiGate: () => {
    const inc = websiteVitestIncludeArgs("ci-website-gate.modules.json").join(" ");
    run(`npm run test:vitest -w agentskeptic-web -- ${inc}`);
  },
  nodeTestSqlite: () => {
    const files = sqliteNodeTestFiles.map((f) => f.replace(/\\/g, "/")).join(" ");
    run(`node --test --test-force-exit ${files}`);
  },
  nodeTestPostgres: () => {
    const files = postgresNodeTestFiles.map((f) => f.replace(/\\/g, "/")).join(" ");
    run("node scripts/pg-ci-init.mjs");
    run(`node --test --test-force-exit ${files}`);
  },
  firstRun: () => run("node scripts/first-run.mjs"),
  validateAdoption1: () => run("node scripts/validate-adoption-complete.mjs"),
  adoptionFailureTest: () => run("node --test test/validate-adoption-complete-failure.test.mjs"),
  validateAdoption2: () => run("node scripts/validate-adoption-complete.mjs"),
  partnerQuickstart: () => run("npm run partner-quickstart"),
  validateIntegrateSpine: () => run("node scripts/validate-integrate-spine.mjs"),
  validateIntegratorOnboarding: () => run("node scripts/validate-integrator-onboarding-shape.mjs"),
  langgraphReferenceVerify: () => run("node scripts/langgraph-reference-verify.mjs"),
  assertNoLanggraphV1: () => run("node scripts/assert-no-langgraph-v1-product-path.mjs"),
  python: () => run("npm run test:python"),
  partnerAdversarial: () => run("node test/partner-quickstart.adversarial.mjs"),
  checkPartnerQuickstart: () => run("npm run check:partner-quickstart"),
  assurance: () =>
    run("node dist/cli.js assurance run --manifest examples/assurance/manifest.json"),
  conformanceAll: () => run("npm run conformance:all"),
  conformanceGate: () =>
    run(
      "npm run conformance:gate && node conformance/assert-bigquery-excluded.mjs && node scripts/assert-support-evidence-sources.mjs",
    ),
  docsCheckCapabilities: () => run("npm run docs:check:capabilities"),
  commercialEnforcePostgres: () => run("node scripts/commercial-enforce-test-harness.mjs --require-postgres"),
  partnerQuickstartPostgres: () => run("node scripts/run-partner-quickstart-postgres-ci.mjs"),
  goldenPathReference: () => run("npm run golden:path"),
  playwrightInstall: () => run("npx playwright install chromium"),
  playwright: () => run("npm run test:debug-ui"),
  rebuildOss: () => run("npm run build"),
  validateTtfv: () => run("npm run validate-ttfv"),
  relatedExists: () => run("node scripts/related-exists-export-user-outcome.mjs"),
  ciWorkflowTruthSingle: () =>
    run(`node --test --test-force-exit ${CI_WORKFLOW_TRUTH_SINGLE}`),
  measureEmissionOnboarding: () => run("npm run measure:emission-onboarding-metrics"),
};

/** Full CI journey (profileCi from former verify.mjs — build/langgraph/epistemic/guards run in gating prelude). */
export const profileCiTail = [
  "vitestRoot",
  "vitestWebsiteCiGate",
  "nodeTestSqlite",
  "firstRun",
  "validateAdoption1",
  "adoptionFailureTest",
  "validateAdoption2",
  "partnerQuickstart",
  "validateIntegrateSpine",
  "validateIntegratorOnboarding",
  "langgraphReferenceVerify",
  "assertNoLanggraphV1",
  "python",
  "partnerAdversarial",
  "checkPartnerQuickstart",
  "assurance",
  "conformanceAll",
  "conformanceGate",
  "docsCheckCapabilities",
  "nodeTestPostgres",
  "partnerQuickstartPostgres",
  "goldenPathReference",
  "commercialEnforcePostgres",
  "playwright",
  "rebuildOss",
  "validateTtfv",
  "relatedExists",
  "ciWorkflowTruthSingle",
  "measureEmissionOnboarding",
];
