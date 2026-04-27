/**
 * Postgres enforce cases (commercial dist only; run via commercial-enforce-test-harness.mjs --require-postgres).
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const eventsPath = join(root, "examples", "events.ndjson");
const registryPath = join(root, "examples", "tools.json");

const cliSpawnMs = 120_000;

describe("CI workflow truth contract (Postgres CLI) enforce", () => {
  const verifyUrl = process.env.POSTGRES_VERIFICATION_URL;

  before(() => {
    assert.ok(verifyUrl && verifyUrl.length > 0, "POSTGRES_VERIFICATION_URL must be set");
  });

  const env = { ...process.env, POSTGRES_VERIFICATION_URL: verifyUrl };

  it("case 5: enforce wf_complete baseline then check exits 0", () => {
    const baseline = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "enforce",
        "--workflow-id",
        "wf_complete",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--postgres-url",
        verifyUrl,
        "--no-human-report",
        "--create-baseline",
      ],
      { encoding: "utf8", cwd: root, env, timeout: cliSpawnMs },
    );
    assert.ok(!baseline.error, baseline.error?.message ?? String(baseline.error));
    assert.equal(baseline.status, 0, baseline.stderr);

    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "enforce",
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
    const parsed = JSON.parse(r.stdout.trim());
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.enforce.status, "ok");
    assert.equal(parsed.enforce.workflow_id, "wf_complete");
  });

  it("case 6: enforce wf_missing baseline then check exits 1", () => {
    const baseline = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "enforce",
        "--workflow-id",
        "wf_missing",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--postgres-url",
        verifyUrl,
        "--no-human-report",
        "--create-baseline",
      ],
      { encoding: "utf8", cwd: root, env, timeout: cliSpawnMs },
    );
    assert.ok(!baseline.error, baseline.error?.message ?? String(baseline.error));
    assert.equal(baseline.status, 1, baseline.stderr);

    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "enforce",
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
    const parsed = JSON.parse(r.stdout.trim());
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.enforce.status, "ok");
    assert.equal(parsed.enforce.workflow_id, "wf_missing");
  });
});
