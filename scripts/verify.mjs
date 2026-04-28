#!/usr/bin/env node
/**
 * Single orchestrator: npm `test` / `test:ci` / `verify:decision-readiness` and `--stages` shims.
 * @see test/suites.mjs for node --test file lists
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

/** @param {string} file basename under website/__tests__ (e.g. ci-website-gate.modules.json) */
function websiteVitestIncludeArgs(modulesFile) {
  const list = JSON.parse(readFileSync(join(websiteTestsDir, modulesFile), "utf8"));
  return list.map((s) => s.replace(/^\.\//, "__tests__/"));
}

const CI_WORKFLOW_TRUTH_SINGLE = "test/ci-workflow-truth-postgres-contract.test.mjs";

function run(cmd) {
  console.error(`[verify] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, cwd: root, shell: true });
}

const stages = {
  build: () => run("npm run build"),
  checkLanggraphEmbeds: () => run("npm run check:langgraph-embeds"),
  epistemic: () => run("npm run check:epistemic-contract-structure"),
  vitestRoot: () => run("npm run test:vitest"),
  vitestWebsiteCiGate: () => {
    const inc = websiteVitestIncludeArgs("ci-website-gate.modules.json").join(" ");
    run(`npm run test:vitest -w agentskeptic-web -- ${inc}`);
  },
  vitestWebsiteDecisionReadiness: () => {
    const inc = websiteVitestIncludeArgs("decision-readiness-gate.modules.json").join(" ");
    run(`npm run test:vitest -w agentskeptic-web -- ${inc}`);
  },
  nodeGuards: () =>
    run(
      "node scripts/align-esbuild-kit-lock-nested.mjs && " +
        "node scripts/contract-manifest.mjs --check && " +
        "node scripts/assert-version-integrity.mjs && " +
        "node scripts/assert-dependency-security-pins.mjs && " +
        "node scripts/assert-no-legacy-verify-surface.mjs && " +
        "node scripts/assert-no-withWorkflowVerification-surface.mjs && " +
        "node scripts/assert-openapi-covers-activation-routes.mjs && " +
        "node scripts/check-agentskeptic-compare-delegation.mjs && " +
        "node scripts/assert-no-adhoc-fetch-for-activation.mjs && " +
        "node scripts/assert-error-code-parity.mjs && " +
        "node scripts/assert-pydantic-matches-openapi.mjs && " +
        "node scripts/assert-deprecations-still-export.mjs && " +
        "node scripts/assert-openapi-types-fresh.mjs && " +
        "node scripts/assert-python-httpx-scope.mjs",
    ),
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
    run("npm run conformance:gate && node conformance/assert-bigquery-excluded.mjs && node scripts/assert-support-evidence-sources.mjs"),
  docsCheckCapabilities: () => run("npm run docs:check:capabilities"),
  commercialEnforce: () => run("node scripts/commercial-enforce-test-harness.mjs"),
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
};

const profileDefault = [
  "build",
  "checkLanggraphEmbeds",
  "epistemic",
  "vitestRoot",
  "vitestWebsiteCiGate",
  "nodeGuards",
  "nodeTestSqlite",
  "firstRun",
  "validateAdoption1",
  "adoptionFailureTest",
  "validateAdoption2",
  "partnerQuickstart",
  "goldenPathReference",
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
  "commercialEnforce",
  "rebuildOss",
  "validateTtfv",
  "relatedExists",
];

const profileCi = [
  "build",
  "checkLanggraphEmbeds",
  "epistemic",
  "vitestRoot",
  "vitestWebsiteCiGate",
  "nodeGuards",
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
  "playwrightInstall",
  "playwright",
  "rebuildOss",
  "validateTtfv",
  "relatedExists",
];

const profileDecisionReadiness = ["vitestWebsiteDecisionReadiness"];

function parseArgs(argv) {
  let profile = null;
  let stageList = null;
  for (const a of argv) {
    if (a.startsWith("--profile=")) {
      profile = a.slice(10);
    } else if (a.startsWith("--stages=")) {
      stageList = a
        .slice(9)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { profile, stageList };
}

const { profile, stageList } = parseArgs(process.argv.slice(2));

if (stageList) {
  for (const id of stageList) {
    if (!stages[id]) {
      console.error(`[verify] unknown stage: ${id}`);
      process.exit(2);
    }
    try {
      stages[id]();
    } catch (e) {
      console.error(e);
      process.exit(typeof e?.status === "number" ? e.status : 1);
    }
  }
  process.exit(0);
}

if (!profile) {
  console.error("Usage: node scripts/verify.mjs --profile=default|ci|decision-readiness");
  console.error("   or: node scripts/verify.mjs --stages=stageId,stageId,...");
  process.exit(2);
}

const order =
  profile === "default"
    ? profileDefault
    : profile === "ci"
      ? profileCi
      : profile === "decision-readiness"
        ? profileDecisionReadiness
        : null;

if (!order) {
  console.error(`[verify] unknown --profile: ${profile}`);
  process.exit(2);
}

for (const id of order) {
  if (!stages[id]) {
    console.error(`[verify] internal error: missing stage ${id}`);
    process.exit(2);
  }
  try {
    stages[id]();
  } catch (e) {
    console.error(e);
    process.exit(typeof e?.status === "number" ? e.status : 1);
  }
}
