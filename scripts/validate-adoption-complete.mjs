#!/usr/bin/env node
/**
 * PatternComplete adoption proof (normative: docs/first-run-integration.md §AdoptionComplete_PatternComplete).
 *
 * Verdict metadata: `commit` and `recordedAt` are fixed literals — not audit-grade provenance.
 *
 * Test-only break: set ADOPTION_COMPLETE_TEST_BREAK=VERIFY to force verify failure (VERIFY_FAILED).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyBatchVerifyWorkload } from "../dist/commercial/verifyWorkloadClassify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const cliPath = join(root, "dist", "cli.js");
const demoDb = join(root, "examples", "demo.db");
const bootstrapInput = join(root, "test", "fixtures", "bootstrap-pack", "input.json");
const verdictPath = join(root, "artifacts", "adoption-complete-validation-verdict.json");
const verdictTmp = join(root, "artifacts", "adoption-complete-validation-verdict.json.tmp");

const FIXED_RECORDED_AT = "1970-01-01T00:00:00.000Z";
const FIXED_COMMIT = "unknown";

const CHECKLIST_KEYS = [
  "AC-OPS-01",
  "AC-OPS-02",
  "AC-OPS-03",
  "AC-TRUST-01",
  "AC-TRUST-02",
  "AC-TRUST-03",
  "AC-TRUST-04",
];

function stableStringify(value, indent = "") {
  const next = indent + "  ";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((v) => stableStringify(v, indent)).join(",") + "]";
  const o = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(o).sort();
  if (keys.length === 0) return "{}";
  const inner = keys.map((k) => `${next}${JSON.stringify(k)}: ${stableStringify(o[k], next)}`).join(",\n");
  return `{\n${inner}\n${indent}}`;
}

function sortedVerdictJson(obj) {
  return stableStringify(obj, "") + "\n";
}

function writeVerdict(payload) {
  const body = sortedVerdictJson(payload);
  writeFileSync(verdictTmp, body, "utf8");
  renameSync(verdictTmp, verdictPath);
}

function allFalseChecklist() {
  /** @type {Record<string, boolean>} */
  const o = {};
  for (const k of CHECKLIST_KEYS) o[k] = false;
  return o;
}

function fail(code, message, checklist, childTail) {
  console.error(`adoption-complete: ${code}`);
  if (childTail) console.error(`adoption-complete: child: ${childTail}`);
  writeVerdict({
    checklist,
    commit: FIXED_COMMIT,
    failure: { code, message },
    provenBy: "scripts/validate-adoption-complete.mjs",
    recordedAt: FIXED_RECORDED_AT,
    schemaVersion: 1,
    scope: "PatternComplete",
    status: "not_solved",
  });
  process.exit(1);
}

function main() {
  const testBreak = process.env.ADOPTION_COMPLETE_TEST_BREAK === "VERIFY";

  if (!existsSync(cliPath)) {
    fail("MISSING_DIST", "dist/cli.js missing; run npm run build from repo root.", allFalseChecklist());
  }
  if (!existsSync(demoDb)) {
    fail("MISSING_DEMO_DB", "examples/demo.db missing; run node scripts/first-run.mjs first.", allFalseChecklist());
  }
  if (!existsSync(bootstrapInput)) {
    fail("MISSING_BOOTSTRAP_INPUT", "test/fixtures/bootstrap-pack/input.json missing.", allFalseChecklist());
  }

  const stamp = `${Date.now()}-${process.pid}`;
  const outDir = join(tmpdir(), `agentskeptic-adopt-out-${stamp}`);
  const adoptDb = join(tmpdir(), `agentskeptic-adopt-db-${stamp}.db`);
  if (existsSync(outDir)) {
    fail("OUT_DIR_COLLISION", `out dir already exists: ${outDir}`, allFalseChecklist());
  }
  copyFileSync(demoDb, adoptDb);

  const boot = spawnSync(
    process.execPath,
    [
      cliPath,
      "bootstrap",
      "--input",
      bootstrapInput,
      "--db",
      demoDb,
      "--out",
      outDir,
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (boot.status !== 0) {
    const tail = (boot.stderr || "").trim().split(/\r?\n/).pop() || "(no stderr)";
    fail("BOOTSTRAP_FAILED", "bootstrap exited non-zero", allFalseChecklist(), tail);
  }

  const eventsPath = join(outDir, "events.ndjson");
  const registryPath = join(outDir, "tools.json");
  const workflowId = testBreak ? "wf_nonexistent_break" : "wf_bootstrap_fixture";

  const wc = classifyBatchVerifyWorkload({
    eventsPath,
    registryPath,
    database: { kind: "sqlite", path: adoptDb },
  });
  if (wc !== "non_bundled") {
    fail(
      "PATH_CLASSIFIER",
      `expected non_bundled workload_class, got ${wc}`,
      allFalseChecklist(),
    );
  }

  const relDb = relative(tmpdir(), adoptDb);
  const dbUnderTmp =
    Boolean(relDb) && !relDb.startsWith("..") && resolve(adoptDb) !== resolve(demoDb);

  const checklistBase = {
    "AC-OPS-01": true,
    "AC-OPS-02": true,
    "AC-OPS-03": dbUnderTmp,
    "AC-TRUST-01": true,
    "AC-TRUST-02": true,
    "AC-TRUST-03": true,
    "AC-TRUST-04": true,
  };

  const verify = spawnSync(
    process.execPath,
    [
      cliPath,
      "--workflow-id",
      workflowId,
      "--events",
      eventsPath,
      "--registry",
      registryPath,
      "--db",
      adoptDb,
    ],
    { cwd: root, encoding: "utf8" },
  );

  if (verify.status !== 0) {
    const tail = (verify.stderr || "").trim().split(/\r?\n/).pop() || "(no stderr)";
    if (testBreak) {
      fail(
        "VERIFY_FAILED",
        "verify exited non-zero (injected break)",
        {
          "AC-OPS-01": true,
          "AC-OPS-02": true,
          "AC-OPS-03": true,
          "AC-TRUST-01": false,
          "AC-TRUST-02": false,
          "AC-TRUST-03": false,
          "AC-TRUST-04": false,
        },
        tail,
      );
    }
    fail("VERIFY_FAILED", "verify exited non-zero", allFalseChecklist(), tail);
  }

  if (!checklistBase["AC-OPS-03"]) {
    fail("PATH_OPS03", "adopt db path invariant failed", allFalseChecklist());
  }

  const outLine = (verify.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop();
  /** Batch verify stdout: Outcome Certificate v1 (current) or legacy one-line WorkflowResult. */
  let verifyStdoutOk = false;
  if (outLine?.includes('"status":"complete"')) {
    verifyStdoutOk = true;
  } else if (outLine) {
    try {
      const o = JSON.parse(outLine);
      if (
        o &&
        typeof o === "object" &&
        o.schemaVersion === 1 &&
        o.stateRelation === "matches_expectations" &&
        o.workflowId === workflowId
      ) {
        verifyStdoutOk = true;
      }
    } catch {
      /* */
    }
  }
  if (!verifyStdoutOk) {
    fail(
      "VERIFY_STDOUT",
      "expected terminal Outcome Certificate v1 (schemaVersion 1, stateRelation matches_expectations, matching workflowId) or legacy WorkflowResult with status complete on stdout",
      checklistBase,
    );
  }

  if (verify.stdout) process.stdout.write(verify.stdout);
  process.stderr.write(verify.stderr || "");
  console.error("adoption-complete: ok");

  writeVerdict({
    checklist: {
      "AC-OPS-01": true,
      "AC-OPS-02": true,
      "AC-OPS-03": true,
      "AC-TRUST-01": true,
      "AC-TRUST-02": true,
      "AC-TRUST-03": true,
      "AC-TRUST-04": true,
    },
    commit: FIXED_COMMIT,
    failure: null,
    provenBy: "scripts/validate-adoption-complete.mjs",
    recordedAt: FIXED_RECORDED_AT,
    schemaVersion: 1,
    scope: "PatternComplete",
    status: "solved",
  });
  process.exit(0);
}

main();
