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
  releaseCriticalVerdictFromWorkflowResult,
} from "./outcomeCertificate.js";
import type { StepOutcome, WorkflowEngineResult, WorkflowResult } from "./types.js";
import { createEmptyVerificationRunContext } from "./verificationRunContext.js";
import { finalizeEmittedWorkflowResult } from "./workflowTruthReport.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const strongPolicy = {
  consistencyMode: "strong" as const,
  verificationWindowMs: 0,
  pollIntervalMs: 0,
};

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

function baseEngine(step: StepOutcome, status: WorkflowEngineResult["status"] = "inconsistent"): WorkflowEngineResult {
  return {
    schemaVersion: 8,
    workflowId: "wf_synthetic",
    status,
    runLevelReasons: [],
    verificationPolicy: strongPolicy,
    eventSequenceIntegrity: { kind: "normal" },
    verificationRunContext: createEmptyVerificationRunContext(),
    steps: [step],
  };
}

function sqlStep(code: string, message: string, status: StepOutcome["status"] = "inconsistent"): StepOutcome {
  return {
    releaseCritical: false,
    seq: 0,
    toolId: "crm.upsert_contact",
    intendedEffect: { narrative: "Upsert contact c_missing" },
    observedExecution: { paramsCanonical: "{}" },
    verificationRequest: {
      kind: "sql_row",
      table: "contacts",
      identityEq: [{ column: "id", value: "c_missing" }],
      requiredFields: { status: "active" },
    },
    status,
    reasons: [{ code, message }],
    evidenceSummary: { rowCount: 0 },
    repeatObservationCount: 1,
    evaluatedObservationOrdinal: 1,
    failureDiagnostic: "workflow_execution",
  };
}

describe("outcomeCertificate", () => {
  it("deriveHighStakesReliance matches normative table", () => {
    expect(deriveHighStakesReliance("quick_preview", "matches_expectations")).toBe("prohibited");
    expect(deriveHighStakesReliance("contract_sql", "matches_expectations")).toBe("permitted");
    expect(deriveHighStakesReliance("contract_sql", "does_not_match")).toBe("prohibited");
    expect(deriveHighStakesReliance("contract_sql", "not_established")).toBe("prohibited");
    expect(deriveHighStakesReliance("contract_sql_langgraph_checkpoint_trust", "matches_expectations")).toBe(
      "permitted",
    );
    expect(deriveHighStakesReliance("contract_sql_langgraph_checkpoint_trust", "not_established")).toBe(
      "prohibited",
    );
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
      const validate = loadSchemaValidator("outcome-certificate-v3");
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
      const item = certificate.evidenceCompleteness.remediationItems?.[0];
      expect(item).toMatchObject({
        id: "step:0",
        scope: "step",
        humanReview: {
          required: true,
          decisionPrompt: "Decide which hypothesis explains the mismatch before changing state or inputs.",
        },
        automation: {
          class: "never_auto_mutate",
          label: "Manual judgment required; do not automate mutation from this result.",
        },
        rerunPath: {
          type: "after_manual_review_verify",
          sameInputs: false,
        },
      });
      expect(certificate.humanReport).toContain(
        "Manual review: Decide which hypothesis explains the mismatch before changing state or inputs.",
      );
    } finally {
      cleanup();
    }
  });

  it("producer invariant rejects failed certificates without remediationItems", async () => {
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
      const malformed = {
        ...certificate,
        evidenceCompleteness: {
          ...certificate.evidenceCompleteness,
          remediationItems: undefined,
        },
      };
      expect(() => assertOutcomeCertificateInvariants(malformed)).toThrow(
        "failed outcome certificate missing evidenceCompleteness.remediationItems",
      );
    } finally {
      cleanup();
    }
  });

  it("multi-effect failures emit item-level remediation instead of aggregate-only prose", () => {
    const raw = readFileSync(join(root, "test/golden/wf_multi_all_fail.stdout.json"), "utf8");
    const result = JSON.parse(raw) as WorkflowResult;
    const certificate = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
    const items = certificate.evidenceCompleteness.remediationItems ?? [];
    expect(items.map((i) => i.id)).toEqual(["effect:0:primary", "effect:0:secondary"]);
    expect(items[0]).toMatchObject({
      id: "effect:0:primary",
      scope: "effect",
      recommendedAction: "reconcile_downstream_state",
      rerunPath: { type: "after_state_fix_verify", sameInputs: false },
    });
    expect(certificate.humanReport).toContain("Remediation items:");
    expect(certificate.humanReport).toContain(
      "- effect:0:primary: Fix downstream database or service state to match declared expectations, then rerun verify.",
    );
  });

  it("connector failures are read-only retry with same inputs", () => {
    const result = finalizeEmittedWorkflowResult(
      baseEngine(
        sqlStep("CONNECTOR_ERROR", "Read-only connector failed", "incomplete_verification"),
        "incomplete",
      ),
    );
    const certificate = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
    const item = certificate.evidenceCompleteness.remediationItems?.[0];
    expect(item).toMatchObject({
      id: "step:0",
      recommendedAction: "improve_read_connectivity",
      automation: {
        class: "read_only_retry",
        label: "Safe automatic action: retry read-only verification with the same inputs.",
      },
      rerunPath: { type: "same_input_verify", sameInputs: true },
    });
    expect(certificate.humanReport).toContain(
      "Automation: Safe automatic action: retry read-only verification with the same inputs.",
    );
  });

  it("determinate state mismatch is human-write-required with after-state-fix rerun", () => {
    const result = finalizeEmittedWorkflowResult(
      baseEngine(sqlStep("DUPLICATE_ROWS", "Duplicate rows matched key")),
    );
    const certificate = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
    const item = certificate.evidenceCompleteness.remediationItems?.[0];
    expect(item).toMatchObject({
      recommendedAction: "deduplicate",
      automation: {
        class: "human_write_required",
        label: "Human or external system must change state; AgentSkeptic will not mutate data.",
      },
      rerunPath: {
        type: "after_state_fix_verify",
        sameInputs: false,
        readinessLabel: "Rerun verify after downstream state matches the expected state.",
      },
    });
    expect(certificate.humanReport).toContain(
      "Rerun: Rerun verify after downstream state matches the expected state.",
    );
  });
});

describe("releaseCriticalVerdictFromWorkflowResult", () => {
  it("returns trusted when no step is release-critical", () => {
    const wf = finalizeEmittedWorkflowResult(
      baseEngine(sqlStep("ROW_ABSENT", "m", "missing"), "inconsistent"),
    );
    expect(releaseCriticalVerdictFromWorkflowResult(wf)).toBe("trusted");
  });

  it("returns not_trusted when a release-critical step is inconsistent", () => {
    const step = { ...sqlStep("DUPLICATE_ROWS", "d"), releaseCritical: true };
    const wf = finalizeEmittedWorkflowResult(baseEngine(step, "inconsistent"));
    expect(releaseCriticalVerdictFromWorkflowResult(wf)).toBe("not_trusted");
  });

  it("returns unknown when a release-critical step is incomplete_verification", () => {
    const step: StepOutcome = {
      releaseCritical: true,
      seq: 0,
      toolId: "t",
      intendedEffect: { narrative: "" },
      observedExecution: { paramsCanonical: "{}" },
      verificationRequest: null,
      status: "incomplete_verification",
      reasons: [{ code: "UNKNOWN_TOOL", message: "u" }],
      evidenceSummary: {},
      repeatObservationCount: 1,
      evaluatedObservationOrdinal: 1,
      failureDiagnostic: "verification_setup",
    };
    const wf = finalizeEmittedWorkflowResult(baseEngine(step, "incomplete"));
    expect(releaseCriticalVerdictFromWorkflowResult(wf)).toBe("unknown");
  });
});
