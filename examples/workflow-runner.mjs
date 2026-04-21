#!/usr/bin/env node
/**
 * Low-friction integration demo: `createDecisionGate`, append events, then `evaluate`.
 */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createDecisionGate } from "../dist/decisionGate.js";
import { loadSchemaValidator } from "../dist/schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const seedPath = join(root, "examples", "seed.sql");
const eventsPath = join(root, "examples", "events.ndjson");
const registryPath = join(root, "examples", "tools.json");

const dir = mkdtempSync(join(tmpdir(), "etl-wf-ex-"));
const dbPath = join(dir, "demo.db");
let exitCode = 1;
try {
  const seedSql = readFileSync(seedPath, "utf8");
  const db = new DatabaseSync(dbPath);
  db.exec(seedSql);
  db.close();

  const firstLine = readFileSync(eventsPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0)[0];
  const ev = JSON.parse(firstLine);

  const gate = createDecisionGate({
    workflowId: "wf_complete",
    registryPath,
    databaseUrl: dbPath,
    projectRoot: root,
    logStep: () => {},
    truthReport: () => {},
  });
  gate.appendRunEvent(ev);
  const result = await gate.evaluate();

  const validateResult = loadSchemaValidator("workflow-result");
  if (!validateResult(result)) {
    console.error("Internal error: result failed schema validation");
  } else if (result.status !== "complete" || result.steps[0]?.status !== "verified") {
    console.error("Expected complete workflow and verified first step");
  } else {
    console.log(JSON.stringify(result));
    exitCode = 0;
  }
} catch (e) {
  console.error(e);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(exitCode);
