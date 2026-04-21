/**
 * Canonical DecisionGate demo (registry + buffered events + SQLite).
 * Run from repo root after `npm run build`: `node examples/decision-gate-canonical.mjs`
 */
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createDecisionGate } from "../dist/decisionGate.js";

const runRoot = join(fileURLToPath(new URL(".", import.meta.url)), ".canonical-verify-run");
mkdirSync(runRoot, { recursive: true });
const projectRoot = mkdtempSync(join(runRoot, "proj-"));

try {
  const d = join(projectRoot, "agentskeptic");
  mkdirSync(d, { recursive: true });
  writeFileSync(
    join(d, "tools.json"),
    JSON.stringify([
      {
        toolId: "crm.upsert_contact",
        effectDescriptionTemplate: "Upsert contact {/recordId} with fields {/fields}",
        verification: {
          kind: "sql_row",
          table: { const: "contacts" },
          identityEq: [{ column: { const: "id" }, value: { pointer: "/recordId" } }],
          requiredFields: { pointer: "/fields" },
        },
      },
    ]) + "\n",
  );

  const dbPath = join(projectRoot, "app.db");
  const db = new DatabaseSync(dbPath);
  db.exec(
    "CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT, status TEXT); INSERT INTO contacts VALUES ('c_ok','Alice','active');",
  );
  db.close();

  const gate = createDecisionGate({
    workflowId: "wf_demo",
    registryPath: join("agentskeptic", "tools.json"),
    databaseUrl: "app.db",
    projectRoot,
    logStep: () => {},
    truthReport: () => {},
  });
  gate.appendRunEvent({
    schemaVersion: 1,
    workflowId: "wf_demo",
    seq: 0,
    type: "tool_observed",
    toolId: "crm.upsert_contact",
    params: { recordId: "c_ok", fields: { name: "Alice", status: "active" } },
  });

  const certificate = await gate.evaluateCertificate();
  const ok =
    certificate.stateRelation === "matches_expectations" && certificate.highStakesReliance === "permitted";
  process.exit(ok ? 0 : 1);
} finally {
  rmSync(projectRoot, { recursive: true, force: true });
}
