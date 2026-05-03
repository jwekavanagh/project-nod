/**
 * Outcome Certificate consumer contract (CLI stdout).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { loadSchemaValidator } from "../dist/schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");

describe("Outcome Certificate consumer contract (CLI stdout)", () => {
  let dir;
  let dbPath;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "etl-consumer-"));
    dbPath = join(dir, "test.db");
    const sql = readFileSync(join(root, "examples", "seed.sql"), "utf8");
    const db = new DatabaseSync(dbPath);
    db.exec(sql);
    db.close();
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("wf_complete certificate validates and maps contract_sql + permitted", () => {
    const eventsPath = join(root, "examples", "events.ndjson");
    const registryPath = join(root, "examples", "tools.json");
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
        "--db",
        dbPath,
      ],
      { encoding: "utf8", cwd: root },
    );
    assert.equal(r.status, 0, r.stderr);
    const parsed = JSON.parse(r.stdout.trim());
    const validateResult = loadSchemaValidator("outcome-certificate-v3");
    assert.equal(validateResult(parsed), true, JSON.stringify(validateResult.errors ?? []));
    assert.equal(parsed.schemaVersion, 2);
    assert.equal(typeof parsed.workflowId, "string");
    assert.equal(parsed.workflowId, "wf_complete");
    assert.equal(parsed.runKind, "contract_sql");
    assert.equal(parsed.stateRelation, "matches_expectations");
    assert.equal(parsed.highStakesReliance, "permitted");
    assert.ok(Array.isArray(parsed.steps));
    assert.ok(parsed.steps.length >= 1);
    const s0 = parsed.steps[0];
    assert.ok(s0 && typeof s0 === "object");
    assert.equal(typeof s0.declaredAction, "string");
    assert.equal(typeof s0.expectedOutcome, "string");
    assert.equal(typeof s0.observedOutcome, "string");
    assert.equal(typeof parsed.humanReport, "string");
    assert.ok(parsed.humanReport.length > 0);
  });
});
