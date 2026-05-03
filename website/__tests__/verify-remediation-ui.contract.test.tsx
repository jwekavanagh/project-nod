// @vitest-environment jsdom

import { CertificateRemediationPanel } from "@/components/verify/CertificateRemediationPanel";
import { AUTOMATION_BOUNDARY_CONNECTOR } from "@/lib/automationBoundaryConnector";
import minimalShare from "@/content/embeddedReports/minimal-share-v2.json";
import { bundledOutcomeCertificateSchema } from "@/lib/verifyBundled.contract";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

export const EXPECTED_MINIMAL_SHARE_PRIMARY =
  "Review the evidence completeness block and workflow truth report, then decide on a manual fix path.";

describe("CertificateRemediationPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("Fixture A (minimal-share-v2): primary action + verdict label", () => {
    const env = minimalShare as { certificate: unknown };
    const certificate = bundledOutcomeCertificateSchema.parse(env.certificate);
    render(<CertificateRemediationPanel certificate={certificate} />);
    expect(screen.getByTestId("remediation-primary-action").textContent).toBe(EXPECTED_MINIMAL_SHARE_PRIMARY);
    expect(screen.getByTestId("remediation-verdict-label").textContent).toContain("Reality contradicts the claim");
  });

  it("Fixture B (CONNECTOR): automation boundary paragraph", () => {
    const certificate = bundledOutcomeCertificateSchema.parse({
      schemaVersion: 3,
      workflowId: "wf_synthetic",
      runKind: "contract_sql",
      stateRelation: "does_not_match",
      highStakesReliance: "prohibited",
      relianceRationale: "r",
      intentSummary: "i",
      explanation: { headline: "h", details: [] },
      steps: [],
      humanReport: "hr",
      evidenceCompleteness: {
        schemaVersion: 1,
        blockerCategory: "database_access",
        quickSignal: "na",
        verifiedClaims: [],
        unverifiedClaims: [],
        missingInputs: [{ code: "CONNECTOR_ERROR", hint: "h" }],
        nextActions: [
          {
            id: "improve_read_connectivity",
            text: "Restore read-only database or witness connectivity and credentials, then rerun verify.",
          },
        ],
      },
      failureSpine: {
        schemaVersion: 1,
        trustDecision: "unsafe",
        summary: "s",
        actionableFailure: {
          category: "downstream_execution_failure",
          severity: "high",
          recommendedAction: "improve_read_connectivity",
          automationSafe: true,
        },
        primaryCodes: ["CONNECTOR_ERROR"],
        rerunGuidance: "Restore read-only database or witness connectivity and credentials, then rerun verify.",
        source: "workflow",
      },
    });
    render(<CertificateRemediationPanel certificate={certificate} />);
    expect(screen.getByTestId("remediation-automation-boundary").textContent).toBe(AUTOMATION_BOUNDARY_CONNECTOR);
  });
});
