// @vitest-environment jsdom

import { CertificateRemediationPanel } from "@/components/verify/CertificateRemediationPanel";
import { AUTOMATION_BOUNDARY_CONNECTOR } from "@/lib/automationBoundaryConnector";
import minimalShare from "@/content/embeddedReports/minimal-share-v3-envelope.json";
import { bundledOutcomeCertificateSchema } from "@/lib/verifyBundled.contract";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

export const EXPECTED_MINIMAL_SHARE_PRIMARY =
  "Review the evidence completeness block and workflow truth report, then decide on a manual fix path.";

describe("CertificateRemediationPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("Fixture A (minimal-share-v3-envelope): primary action + verdict label", () => {
    const env = minimalShare as { certificate: unknown };
    const certificate = bundledOutcomeCertificateSchema.parse(env.certificate);
    render(<CertificateRemediationPanel certificate={certificate} />);
    expect(screen.getByTestId("remediation-primary-action").textContent).toBe(EXPECTED_MINIMAL_SHARE_PRIMARY);
    expect(screen.getByTestId("remediation-verdict-label").textContent).toContain("Reality contradicts the claim");
  });

  it("Fixture A (/verify demo presentation): trust pill + decision grid fields", () => {
    const env = minimalShare as { certificate: unknown };
    const certificate = bundledOutcomeCertificateSchema.parse(env.certificate);
    render(<CertificateRemediationPanel certificate={certificate} presentation="verify-demo" />);
    expect(screen.getByTestId("verify-paste-trust-pill")).toHaveTextContent("NOT TRUSTED");
    expect(screen.getByText("crm.upsert_contact")).toBeTruthy();
    expect(screen.getByText("state_mismatch")).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
    expect(screen.getByTestId("verify-paste-demo-next-action")).toHaveTextContent(
      "Review the evidence completeness block and workflow truth report, then decide on a manual fix path.",
    );
    expect(screen.queryByTestId("remediation-primary-action")).toBeNull();
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
        rerunPath: {
          type: "same_input_verify",
          sameInputs: true,
          prerequisite: "Read-only database or witness connectivity is restored.",
          meaningfulWhen: "The same captured events, registry, workflow, and read target can be checked again.",
          readinessLabel: "Rerun verify with the same inputs after the read-only prerequisite is restored.",
        },
        remediationItems: [
          {
            id: "step:0",
            scope: "step",
            primary: true,
            failedCheck: "Failed check: step 0 (crm.read_contact)",
            reasonCodes: ["CONNECTOR_ERROR"],
            reason: "Read-only connector failed.",
            recommendedAction: "improve_read_connectivity",
            actionText: "Restore read-only database or witness connectivity and credentials, then rerun verify.",
            expectedState: {
              summary: "Expected read-only witness to be reachable for this verification.",
            },
            automation: {
              class: "read_only_retry",
              label: "Safe automatic action: retry read-only verification with the same inputs.",
              boundary: AUTOMATION_BOUNDARY_CONNECTOR,
            },
            humanReview: { required: false },
            rerunPath: {
              type: "same_input_verify",
              sameInputs: true,
              prerequisite: "Read-only database or witness connectivity is restored.",
              meaningfulWhen: "The same captured events, registry, workflow, and read target can be checked again.",
              readinessLabel: "Rerun verify with the same inputs after the read-only prerequisite is restored.",
            },
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
    expect(screen.getByText("Failed check: step 0 (crm.read_contact)")).toBeTruthy();
    expect(screen.getByText("Expected read-only witness to be reachable for this verification.")).toBeTruthy();
    expect(screen.getByText("Safe automatic action: retry read-only verification with the same inputs.")).toBeTruthy();
    expect(screen.getAllByText("Rerun verify with the same inputs after the read-only prerequisite is restored.").length).toBeGreaterThan(0);
  });

  it("Fixture C (manual review): renders decision prompt without raw enum-first guidance", () => {
    const certificate = bundledOutcomeCertificateSchema.parse({
      schemaVersion: 3,
      workflowId: "wf_manual",
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
        blockerCategory: "state_mismatch",
        quickSignal: "na",
        verifiedClaims: [],
        unverifiedClaims: [],
        missingInputs: [{ code: "ROW_ABSENT", hint: "h" }],
        nextActions: [
          {
            id: "manual_review",
            text: "Review the evidence completeness block and workflow truth report, then decide on a manual fix path.",
          },
        ],
        rerunPath: {
          type: "after_manual_review_verify",
          sameInputs: false,
          prerequisite: "A human reviewer chooses and applies the correct fix path.",
          meaningfulWhen: "The reviewer has resolved which hypothesis is true and updated state or inputs accordingly.",
          readinessLabel: "Rerun verify after a human reviewer chooses and applies the correct fix path.",
        },
        remediationItems: [
          {
            id: "step:0",
            scope: "step",
            primary: true,
            failedCheck: "Failed check: step 0 (crm.upsert_contact)",
            reasonCodes: ["ROW_ABSENT"],
            reason: "No row matched key.",
            recommendedAction: "manual_review",
            actionText: "Review the evidence completeness block and workflow truth report, then decide on a manual fix path.",
            expectedState: { summary: "Expected contacts row id=c_missing to exist." },
            automation: {
              class: "never_auto_mutate",
              label: "Manual judgment required; do not automate mutation from this result.",
              boundary:
                "AgentSkeptic is a read-only verifier. It does not mutate databases, rewrite inputs, or execute remediation.",
            },
            humanReview: {
              required: true,
              decisionPrompt: "Decide which hypothesis explains the mismatch before changing state or inputs.",
            },
            rerunPath: {
              type: "after_manual_review_verify",
              sameInputs: false,
              prerequisite: "A human reviewer chooses and applies the correct fix path.",
              meaningfulWhen: "The reviewer has resolved which hypothesis is true and updated state or inputs accordingly.",
              readinessLabel: "Rerun verify after a human reviewer chooses and applies the correct fix path.",
            },
          },
        ],
      },
      failureSpine: {
        schemaVersion: 1,
        trustDecision: "unsafe",
        summary: "s",
        actionableFailure: {
          category: "ambiguous",
          severity: "high",
          recommendedAction: "manual_review",
          automationSafe: false,
        },
        primaryCodes: ["ROW_ABSENT"],
        rerunGuidance: "Review the evidence completeness block and workflow truth report, then decide on a manual fix path.",
        source: "workflow",
      },
    });
    render(<CertificateRemediationPanel certificate={certificate} />);
    expect(screen.getByText("Decide which hypothesis explains the mismatch before changing state or inputs.")).toBeTruthy();
    expect(screen.getByText("Manual judgment required; do not automate mutation from this result.")).toBeTruthy();
    expect(screen.getByText("Expected contacts row id=c_missing to exist.")).toBeTruthy();
  });
});
