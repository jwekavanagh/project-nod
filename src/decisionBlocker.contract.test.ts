import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOutcomeCertificateFromWorkflowResult } from "./outcomeCertificate.js";
import { formatDecisionBlockerForHumans } from "./decisionBlocker.js";
import { verifyWorkflow } from "./pipeline.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");

describe("formatDecisionBlockerForHumans contract", () => {
  it("emits exactly six lines with required tokens for wf_missing certificate", async () => {
    const eventsPath = join(root, "examples", "events.ndjson");
    const registryPath = join(root, "examples", "tools.json");
    const dbPath = join(root, "examples", "demo.db");
    const result = await verifyWorkflow({
      workflowId: "wf_missing",
      eventsPath,
      registryPath,
      database: { kind: "sqlite", path: dbPath },
      logStep: () => {},
      truthReport: () => {},
    });
    const certificate = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
    const { lines, trustDecision } = formatDecisionBlockerForHumans(certificate);
    expect(trustDecision).toBe("unsafe");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toMatch(/^Trust: unsafe$/);
    expect(lines[1]).toMatch(/^Workflow: wf_missing$/);
    expect(lines[2]).toMatch(/^First problem step: seq=/);
    expect(lines[2]).toContain("tool=crm.upsert_contact");
    expect(lines[2]).toContain("status=missing");
    expect(lines[3]).toContain("ROW_ABSENT");
    expect(lines[4]).toMatch(/^Expected: /);
    expect(lines[5]).toMatch(/^Observed: /);
  });
});
