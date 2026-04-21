import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { loadSchemaValidator } from "./schemaLoad.js";
import { verifyWorkflow } from "./pipeline.js";
import {
  assertOutcomeCertificateInvariants,
  buildOutcomeCertificateFromWorkflowResult,
  deriveHighStakesReliance,
  formatOutcomeCertificateHuman,
} from "./outcomeCertificate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function seedTempSqliteDb(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "outcome-cert-"));
  const dbPath = join(dir, "demo.db");
  const seed = readFileSync(join(root, "examples", "seed.sql"), "utf8");
  const db = new DatabaseSync(dbPath);
  db.exec(seed);
  db.close();
  return {
    dbPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe("outcomeCertificate", () => {
  it("deriveHighStakesReliance matches normative table", () => {
    expect(deriveHighStakesReliance("quick_preview", "matches_expectations")).toBe("prohibited");
    expect(deriveHighStakesReliance("contract_sql", "matches_expectations")).toBe("permitted");
    expect(deriveHighStakesReliance("contract_sql", "does_not_match")).toBe("prohibited");
    expect(deriveHighStakesReliance("contract_sql", "not_established")).toBe("prohibited");
  });

  it("wf_complete certificate passes schema and invariants", async () => {
    const { dbPath, cleanup } = seedTempSqliteDb();
    try {
      const result = await verifyWorkflow({
        workflowId: "wf_complete",
        eventsPath: join(root, "examples", "events.ndjson"),
        registryPath: join(root, "examples", "tools.json"),
        database: { kind: "sqlite", path: dbPath },
        logStep: () => {},
        truthReport: () => {},
      });
      const certificate = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
      const validate = loadSchemaValidator("outcome-certificate-v1");
      expect(validate(certificate)).toBe(true);
      assertOutcomeCertificateInvariants(certificate);
      expect(formatOutcomeCertificateHuman(certificate)).toBe(certificate.humanReport);
    } finally {
      cleanup();
    }
  });

  it("wf_missing certificate is does_not_match", async () => {
    const { dbPath, cleanup } = seedTempSqliteDb();
    try {
      const result = await verifyWorkflow({
        workflowId: "wf_missing",
        eventsPath: join(root, "examples", "events.ndjson"),
        registryPath: join(root, "examples", "tools.json"),
        database: { kind: "sqlite", path: dbPath },
        logStep: () => {},
        truthReport: () => {},
      });
      const certificate = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
      expect(certificate.stateRelation).toBe("does_not_match");
      expect(certificate.highStakesReliance).toBe("prohibited");
    } finally {
      cleanup();
    }
  });
});
