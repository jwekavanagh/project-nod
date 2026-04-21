/**
 * DecisionGate integration tests — dist bundle.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as api from "../dist/index.js";
import { verifyWorkflow } from "../dist/pipeline.js";
import { createDecisionGate } from "../dist/decisionGate.js";
import { loadSchemaValidator } from "../dist/schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function eventsForWorkflow(eventsPath, workflowId) {
  const lines = readFileSync(eventsPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out = [];
  for (const line of lines) {
    const ev = JSON.parse(line);
    if (ev.workflowId === workflowId) {
      out.push(ev);
    }
  }
  return out;
}

describe("DecisionGate", () => {
  let dir;
  let dbPath;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "etl-dg-"));
    dbPath = join(dir, "test.db");
    const sql = readFileSync(join(root, "examples", "seed.sql"), "utf8");
    const db = new DatabaseSync(dbPath);
    db.exec(sql);
    db.close();
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const eventsPath = join(root, "examples", "events.ndjson");
  const registryPath = join(root, "examples", "tools.json");
  const noopLog = () => {};

  it("public export surface", () => {
    assert.equal(Object.hasOwn(api, "createDecisionGate"), true);
    assert.equal(typeof api.createDecisionGate, "function");
    assert.equal(Object.hasOwn(api, "formatWorkflowTruthReport"), true);
    assert.equal(typeof api.formatWorkflowTruthReport, "function");
    assert.equal(Object.hasOwn(api, "STEP_STATUS_TRUTH_LABELS"), true);
    assert.equal(api.STEP_STATUS_TRUTH_LABELS.verified, "VERIFIED");
    assert.equal(Object.hasOwn(api, "HUMAN_REPORT_RESULT_PHRASE"), true);
    assert.equal(api.HUMAN_REPORT_RESULT_PHRASE.VERIFIED, "Matched the database.");
    assert.equal(Object.hasOwn(api, "withWorkflowVerification"), false);
  });

  it("eventual verificationPolicy on gate matches verifyWorkflow", async () => {
    const policy = {
      consistencyMode: "eventual",
      verificationWindowMs: 100,
      pollIntervalMs: 50,
    };
    const batchResult = await verifyWorkflow({
      workflowId: "wf_complete",
      eventsPath,
      registryPath,
      database: { kind: "sqlite", path: dbPath },
      logStep: noopLog,
      truthReport: () => {},
      verificationPolicy: policy,
    });
    const gate = createDecisionGate({
      workflowId: "wf_complete",
      registryPath,
      databaseUrl: dbPath,
      projectRoot: root,
      logStep: noopLog,
      truthReport: () => {},
      verificationPolicy: policy,
    });
    for (const ev of eventsForWorkflow(eventsPath, "wf_complete")) {
      gate.appendRunEvent(ev);
    }
    const gateResult = await gate.evaluate();
    assert.deepStrictEqual(gateResult, batchResult);
  });

  it("parity wf_complete wf_missing wf_dup_seq wf_divergent_retry vs verifyWorkflow", async () => {
    for (const wf of ["wf_complete", "wf_missing", "wf_dup_seq", "wf_divergent_retry"]) {
      const events = eventsForWorkflow(eventsPath, wf);
      const batchResult = await verifyWorkflow({
        workflowId: wf,
        eventsPath,
        registryPath,
        database: { kind: "sqlite", path: dbPath },
        logStep: noopLog,
        truthReport: () => {},
      });
      const gate = createDecisionGate({
        workflowId: wf,
        registryPath,
        databaseUrl: dbPath,
        projectRoot: root,
        logStep: noopLog,
        truthReport: () => {},
      });
      for (const ev of events) {
        gate.appendRunEvent(ev);
      }
      const gateResult = await gate.evaluate();
      assert.deepStrictEqual(gateResult, batchResult);
    }
  });

  it("out-of-order appendRunEvent matches verifyWorkflow on same capture-ordered NDJSON", async () => {
    const evLate = {
      schemaVersion: 1,
      workflowId: "wf_wrap_order",
      seq: 1,
      type: "tool_observed",
      toolId: "crm.upsert_contact",
      params: { recordId: "c_bad", fields: { name: "Bob", status: "active" } },
    };
    const evFirst = {
      schemaVersion: 1,
      workflowId: "wf_wrap_order",
      seq: 0,
      type: "tool_observed",
      toolId: "crm.upsert_contact",
      params: { recordId: "c_ok", fields: { name: "Alice", status: "active" } },
    };
    const nd = join(dir, "wrap_order.ndjson");
    writeFileSync(nd, `${JSON.stringify(evLate)}\n${JSON.stringify(evFirst)}\n`);
    const batchResult = await verifyWorkflow({
      workflowId: "wf_wrap_order",
      eventsPath: nd,
      registryPath,
      database: { kind: "sqlite", path: dbPath },
      logStep: noopLog,
      truthReport: () => {},
    });
    const gate = createDecisionGate({
      workflowId: "wf_wrap_order",
      registryPath,
      databaseUrl: dbPath,
      projectRoot: root,
      logStep: noopLog,
      truthReport: () => {},
    });
    gate.appendRunEvent(evLate);
    gate.appendRunEvent(evFirst);
    const gateResult = await gate.evaluate();
    assert.deepStrictEqual(gateResult, batchResult);
    assert.equal(gateResult.eventSequenceIntegrity.kind, "irregular");
  });

  it("non-object appendRunEvent → MALFORMED_EVENT_LINE, incomplete, no steps", async () => {
    const gate = createDecisionGate({
      workflowId: "wf_complete",
      registryPath,
      databaseUrl: dbPath,
      projectRoot: root,
      logStep: noopLog,
      truthReport: () => {},
    });
    gate.appendRunEvent("not-json-line");
    const result = await gate.evaluate();
    assert.equal(result.status, "incomplete");
    assert.ok(result.runLevelReasons.map((x) => x.code).includes("MALFORMED_EVENT_LINE"));
    assert.equal(result.steps.length, 0);
  });

  it("invalid object appendRunEvent → MALFORMED_EVENT_LINE", async () => {
    const gate = createDecisionGate({
      workflowId: "wf_complete",
      registryPath,
      databaseUrl: dbPath,
      projectRoot: root,
      logStep: noopLog,
      truthReport: () => {},
    });
    gate.appendRunEvent({});
    const result = await gate.evaluate();
    assert.equal(result.status, "incomplete");
    assert.ok(result.runLevelReasons.map((x) => x.code).includes("MALFORMED_EVENT_LINE"));
    assert.equal(result.steps.length, 0);
  });

  it("wrong workflowId on event is skipped", async () => {
    const good = eventsForWorkflow(eventsPath, "wf_complete")[0];
    const other = eventsForWorkflow(eventsPath, "wf_missing")[0];
    const gate = createDecisionGate({
      workflowId: "wf_complete",
      registryPath,
      databaseUrl: dbPath,
      projectRoot: root,
      logStep: noopLog,
      truthReport: () => {},
    });
    gate.appendRunEvent(other);
    gate.appendRunEvent(good);
    const result = await gate.evaluate();
    const batchResult = await verifyWorkflow({
      workflowId: "wf_complete",
      eventsPath,
      registryPath,
      database: { kind: "sqlite", path: dbPath },
      logStep: noopLog,
      truthReport: () => {},
    });
    assert.deepStrictEqual(result, batchResult);
  });

  it("duplicate seq matches batch wf_dup_seq", async () => {
    const events = eventsForWorkflow(eventsPath, "wf_dup_seq");
    assert.equal(events.length, 2);
    const batchResult = await verifyWorkflow({
      workflowId: "wf_dup_seq",
      eventsPath,
      registryPath,
      database: { kind: "sqlite", path: dbPath },
      logStep: noopLog,
      truthReport: () => {},
    });
    const gate = createDecisionGate({
      workflowId: "wf_dup_seq",
      registryPath,
      databaseUrl: dbPath,
      projectRoot: root,
      logStep: noopLog,
      truthReport: () => {},
    });
    assert.equal(gate.appendRunEvent(events[0]), undefined);
    assert.equal(gate.appendRunEvent(events[1]), undefined);
    const result = await gate.evaluate();
    assert.deepStrictEqual(result, batchResult);
    assert.equal(result.status, "complete");
    assert.equal(result.steps.length, 1);
  });

  it("success path WorkflowResult validates workflow-result schema", async () => {
    const ev = eventsForWorkflow(eventsPath, "wf_complete")[0];
    const gate = createDecisionGate({
      workflowId: "wf_complete",
      registryPath,
      databaseUrl: dbPath,
      projectRoot: root,
      logStep: noopLog,
      truthReport: () => {},
    });
    gate.appendRunEvent(ev);
    const result = await gate.evaluate();
    const validateResult = loadSchemaValidator("workflow-result");
    assert.equal(validateResult(result), true);
  });
});
