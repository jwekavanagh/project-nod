/**
 * CI workflow truth contract (Postgres CLI): machine-enforced parity with docs/agentskeptic.md
 * "### CI workflow truth contract (Postgres CLI)".
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadSchemaValidator } from "../dist/schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const eventsPath = join(root, "examples", "events.ndjson");
const registryPath = join(root, "examples", "tools.json");
/** Bound hung CLI regressions (spawnSync defaults to waiting forever). */
const cliSpawnMs = 120_000;

describe("CI workflow truth contract (Postgres CLI)", () => {
  const verifyUrl = process.env.POSTGRES_VERIFICATION_URL;

  before(() => {
    assert.ok(verifyUrl && verifyUrl.length > 0, "POSTGRES_VERIFICATION_URL must be set");
  });

  const env = { ...process.env, POSTGRES_VERIFICATION_URL: verifyUrl };

  it("case 1: wf_complete exit 0; stdout Outcome Certificate; stderr empty with --no-human-report", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "--workflow-id",
        "wf_complete",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--postgres-url",
        verifyUrl,
        "--no-human-report",
      ],
      { encoding: "utf8", cwd: root, env, timeout: cliSpawnMs },
    );
    assert.ok(!r.error, r.error?.message ?? String(r.error));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, "");
    const parsed = JSON.parse(r.stdout.trim());
    const validateResult = loadSchemaValidator("outcome-certificate-v3");
    assert.equal(validateResult(parsed), true, JSON.stringify(validateResult.errors ?? []));
    assert.equal(parsed.schemaVersion, 2);
    assert.equal(parsed.workflowId, "wf_complete");
    assert.equal(parsed.stateRelation, "matches_expectations");
    assert.equal(parsed.highStakesReliance, "permitted");
    assert.equal(parsed.runKind, "contract_sql");
    assert.ok(Array.isArray(parsed.steps));
    assert.ok(parsed.steps.length >= 1);
  });

  it("case 2: wf_missing exit 1; stderr empty with --no-human-report", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "--workflow-id",
        "wf_missing",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--postgres-url",
        verifyUrl,
        "--no-human-report",
      ],
      { encoding: "utf8", cwd: root, env, timeout: cliSpawnMs },
    );
    assert.ok(!r.error, r.error?.message ?? String(r.error));
    assert.equal(r.status, 1, r.stderr);
    assert.equal(r.stderr, "");
    const parsed = JSON.parse(r.stdout.trim());
    const validateResult = loadSchemaValidator("outcome-certificate-v3");
    assert.equal(validateResult(parsed), true);
    assert.equal(parsed.schemaVersion, 2);
    assert.equal(parsed.workflowId, "wf_missing");
    assert.equal(parsed.stateRelation, "does_not_match");
    assert.equal(parsed.highStakesReliance, "prohibited");
    assert.ok(parsed.explanation?.headline?.length > 0);
  });

  it("case 3: wf_rel_pg sql_relational on stdout (fixture registry + events)", () => {
    const relEvents = join(root, "test", "fixtures", "relational-verification", "events.ndjson");
    const relReg = join(root, "test", "fixtures", "relational-verification", "registry.json");
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "--workflow-id",
        "wf_rel_pg",
        "--events",
        relEvents,
        "--registry",
        relReg,
        "--postgres-url",
        verifyUrl,
        "--no-human-report",
      ],
      { encoding: "utf8", cwd: root, env, timeout: cliSpawnMs },
    );
    assert.ok(!r.error, r.error?.message ?? String(r.error));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, "");
    const parsed = JSON.parse(r.stdout.trim());
    const validateResult = loadSchemaValidator("outcome-certificate-v3");
    assert.equal(validateResult(parsed), true, JSON.stringify(validateResult.errors ?? []));
    assert.equal(parsed.schemaVersion, 2);
    assert.equal(parsed.workflowId, "wf_rel_pg");
    assert.equal(parsed.stateRelation, "matches_expectations");
    assert.ok(Array.isArray(parsed.steps));
    assert.ok(parsed.steps.length >= 1);
  });

  it("case 4: operational CLI_USAGE — only --workflow-id wf_complete", () => {
    const r = spawnSync(
      process.execPath,
      ["--no-warnings", cliJs, "--workflow-id", "wf_complete"],
      { encoding: "utf8", cwd: root, timeout: cliSpawnMs },
    );
    assert.ok(!r.error, r.error?.message ?? String(r.error));
    assert.equal(r.status, 3);
    assert.equal(r.stdout.trim(), "");
    const err = JSON.parse(r.stderr.trim());
    assert.equal(err.schemaVersion, 2);
    assert.equal(err.kind, "execution_truth_layer_error");
    assert.equal(err.code, "CLI_USAGE");
    assert.equal(typeof err.message, "string");
    assert.ok(err.message.length > 0);
    assert.ok(err.message.length <= 2048);
    assert.ok(err.failureDiagnosis && typeof err.failureDiagnosis === "object");
    assert.equal(typeof err.failureDiagnosis.summary, "string");
    assert.ok(err.failureDiagnosis.summary.length > 0);
    assert.equal(typeof err.failureDiagnosis.primaryOrigin, "string");
    assert.ok(["high", "medium", "low"].includes(err.failureDiagnosis.confidence));
    assert.ok(Array.isArray(err.failureDiagnosis.evidence));
  });
});
