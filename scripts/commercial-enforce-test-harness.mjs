#!/usr/bin/env node
/**
 * Starts a minimal license reserve mock, builds commercial dist, runs enforce integration tests.
 * Usage: node scripts/commercial-enforce-test-harness.mjs [--require-postgres]
 *
 * Uses async spawn (not spawnSync) while the mock HTTP server is listening so the event loop
 * keeps turning — spawnSync here can deadlock tsc on Windows.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const requirePostgres = process.argv.includes("--require-postgres");

if (requirePostgres && !process.env.POSTGRES_VERIFICATION_URL?.trim()) {
  console.error("commercial-enforce-test-harness: POSTGRES_VERIFICATION_URL is required with --require-postgres");
  process.exit(1);
}

const reserveIntentLogPath = path.join(tmpdir(), `agentskeptic-harness-reserve-intents-${randomUUID()}.log`);
writeFileSync(reserveIntentLogPath, "", "utf8");
const baselineByWorkflow = new Map();

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "x-request-id": randomUUID() });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/v1/usage/reserve") {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => {
      try {
        const body = JSON.parse(raw || "{}");
        if (typeof body.intent === "string") {
          appendFileSync(reserveIntentLogPath, `${body.intent}\n`, "utf8");
        }
      } catch {
        /* ignore */
      }
      json(res, 200, { allowed: true, plan: "business", limit: 50000, used: 0 });
    });
    return;
  }
  if (
    req.method === "POST" &&
    (req.url === "/api/v1/enforcement/baselines" ||
      req.url === "/api/v1/enforcement/check" ||
      req.url === "/api/v1/enforcement/accept")
  ) {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => {
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        json(res, 400, { detail: "invalid json" });
        return;
      }
      const workflowId = typeof body.workflow_id === "string" ? body.workflow_id : "";
      const projectionHash = typeof body.material_truth_sha256 === "string" ? body.material_truth_sha256 : "";
      if (!workflowId || !projectionHash || body.schema_version !== 2) {
        json(res, 400, { detail: "schema_version=2, workflow_id and material_truth_sha256 are required" });
        return;
      }
      if (req.url === "/api/v1/enforcement/baselines" || req.url === "/api/v1/enforcement/accept") {
        baselineByWorkflow.set(workflowId, projectionHash);
        json(res, 200, { schema_version: 1, status: "ok", workflow_id: workflowId });
        return;
      }
      const expected = baselineByWorkflow.get(workflowId);
      if (!expected) {
        json(res, 409, { detail: "baseline not initialized" });
        return;
      }
      if (expected === projectionHash) {
        json(res, 200, {
          schema_version: 1,
          status: "ok",
          workflow_id: workflowId,
          expected_projection_hash: expected,
          actual_projection_hash: projectionHash,
        });
        return;
      }
      json(res, 200, {
        schema_version: 1,
        status: "drift",
        workflow_id: workflowId,
        expected_projection_hash: expected,
        actual_projection_hash: projectionHash,
      });
    });
    return;
  }
  res.statusCode = 404;
  res.end();
});

await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
});

const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;
const harnessEnv = {
  ...process.env,
  COMMERCIAL_LICENSE_API_BASE_URL: baseUrl,
  AGENTSKEPTIC_API_KEY: "wfv_test_harness_key",
  HARNESS_RESERVE_INTENT_LOG: reserveIntentLogPath,
};

/**
 * @param {string} execPath
 * @param {string[]} args
 */
function runChild(execPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(execPath, args, {
      cwd: root,
      env: harnessEnv,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({ status: code, signal });
    });
  });
}

async function runCommercialBuild() {
  return runChild(process.execPath, [path.join(root, "scripts", "build-commercial.mjs")]);
}

/** @param {string} testFile */
function nodeTest(testFile) {
  return runChild(process.execPath, ["--test", "--test-force-exit", testFile]);
}

/** @param {string} scriptRel */
function nodeScript(scriptRel) {
  return runChild(process.execPath, [path.join(root, scriptRel)]);
}

let exitCode = 0;

try {
  const b = await runCommercialBuild();
  if (b.status !== 0) {
    exitCode = b.status ?? 1;
  } else {
    const steps = [
      () => nodeTest("test/crossing-commercial-smoke.test.mjs"),
      () => nodeTest("test/enforce-cli.test.mjs"),
      () => nodeTest("test/commercial-license-reserve-intent.test.mjs"),
      () => nodeTest("test/assurance-cli-enforce.test.mjs"),
      () => nodeTest("test/assurance-cli.test.mjs"),
      () => nodeScript("examples/minimal-ci-enforcement/run.mjs"),
    ];
    if (requirePostgres) {
      steps.push(() => nodeTest("test/ci-workflow-truth-postgres-enforce.test.mjs"));
    }
    for (const step of steps) {
      const r = await step();
      if (r.status !== 0) {
        exitCode = r.status ?? 1;
        break;
      }
    }
  }
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
}

process.exit(exitCode);
