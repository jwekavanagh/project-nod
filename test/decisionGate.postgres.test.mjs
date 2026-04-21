/**
 * DecisionGate buffered path vs verifyWorkflow on Postgres (same kernel / data).
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyWorkflow } from "../dist/pipeline.js";
import { createDecisionGate } from "../dist/decisionGate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const eventsPath = join(root, "examples", "events.ndjson");
const registryPath = join(root, "examples", "tools.json");
const verifyUrl = process.env.POSTGRES_VERIFICATION_URL;

describe("createDecisionGate Postgres integration", () => {
  before(() => {
    assert.ok(verifyUrl && verifyUrl.length > 0, "POSTGRES_VERIFICATION_URL must be set");
  });

  const noopLog = () => {};
  const pgDb = () => ({ kind: "postgres", connectionString: verifyUrl });

  it("wf_complete matches verifyWorkflow on same events", async () => {
    let ev;
    for (const line of readFileSync(eventsPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0)) {
      const o = JSON.parse(line);
      if (o.workflowId === "wf_complete") {
        ev = o;
        break;
      }
    }
    assert.ok(ev);

    const expected = await verifyWorkflow({
      workflowId: "wf_complete",
      eventsPath,
      registryPath,
      database: pgDb(),
      logStep: noopLog,
      truthReport: () => {},
    });

    const gate = createDecisionGate({
      workflowId: "wf_complete",
      registryPath,
      databaseUrl: verifyUrl,
      projectRoot: root,
      logStep: noopLog,
      truthReport: () => {},
    });
    gate.appendRunEvent(ev);
    const actual = await gate.evaluate();

    assert.deepStrictEqual(actual, expected);
  });
});
