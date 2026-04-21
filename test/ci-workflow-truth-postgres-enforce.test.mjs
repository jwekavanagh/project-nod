/**
 * Postgres enforce cases (commercial dist only; run via commercial-enforce-test-harness.mjs --require-postgres).
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  LOCK_SUCCESS_MONETIZED_BOUNDARY_LINE_A,
  LOCK_SUCCESS_MONETIZED_BOUNDARY_LINE_B,
} from "../dist/cli/lockOrchestration.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const eventsPath = join(root, "examples", "events.ndjson");
const registryPath = join(root, "examples", "tools.json");
const lockComplete = join(root, "test", "fixtures", "ci-enforcement", "wf_complete.ci-lock-v1.json");
const lockMissing = join(root, "test", "fixtures", "ci-enforcement", "wf_missing.ci-lock-v1.json");

const cliSpawnMs = 120_000;

/** stdout is Outcome Certificate v1 (not legacy WorkflowResult schemaVersion 15). */
function isOutcomeCertificateV1(obj) {
  return (
    obj !== null &&
    typeof obj === "object" &&
    obj.schemaVersion === 1 &&
    typeof obj.stateRelation === "string" &&
    Object.prototype.hasOwnProperty.call(obj, "humanReport")
  );
}

describe("CI workflow truth contract (Postgres CLI) enforce", () => {
  const verifyUrl = process.env.POSTGRES_VERIFICATION_URL;

  before(() => {
    assert.ok(verifyUrl && verifyUrl.length > 0, "POSTGRES_VERIFICATION_URL must be set");
  });

  const env = { ...process.env, POSTGRES_VERIFICATION_URL: verifyUrl };

  it("case 5: enforce batch wf_complete expect-lock exit 0", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "enforce",
        "batch",
        "--workflow-id",
        "wf_complete",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--postgres-url",
        verifyUrl,
        "--no-human-report",
        "--expect-lock",
        lockComplete,
      ],
      { encoding: "utf8", cwd: root, env, timeout: cliSpawnMs },
    );
    assert.ok(!r.error, r.error?.message ?? String(r.error));
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stderr.includes(LOCK_SUCCESS_MONETIZED_BOUNDARY_LINE_A), r.stderr);
    assert.ok(r.stderr.includes(LOCK_SUCCESS_MONETIZED_BOUNDARY_LINE_B), r.stderr);
    const parsed = JSON.parse(r.stdout.trim());
    assert.equal(parsed.workflowId, "wf_complete");
    if (isOutcomeCertificateV1(parsed)) {
      assert.equal(parsed.stateRelation, "matches_expectations");
    } else {
      assert.equal(parsed.status, "complete");
    }
  });

  it("case 6: enforce batch wf_missing expect-lock exit 1", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "enforce",
        "batch",
        "--workflow-id",
        "wf_missing",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--postgres-url",
        verifyUrl,
        "--no-human-report",
        "--expect-lock",
        lockMissing,
      ],
      { encoding: "utf8", cwd: root, env, timeout: cliSpawnMs },
    );
    assert.ok(!r.error, r.error?.message ?? String(r.error));
    assert.equal(r.status, 1, r.stderr);
    assert.equal(r.stderr, "");
    const parsed = JSON.parse(r.stdout.trim());
    assert.equal(parsed.workflowId, "wf_missing");
    if (isOutcomeCertificateV1(parsed)) {
      assert.equal(parsed.stateRelation, "does_not_match");
    } else {
      assert.equal(parsed.status, "inconsistent");
    }
  });
});
