"use client";

import { AUTOMATION_BOUNDARY_CONNECTOR } from "@/lib/automationBoundaryConnector";
import { deriveVerdictComprehension, type VerdictComprehensionInput } from "@/lib/verdictComprehension";
import type { BundledOutcomeCertificate } from "@/lib/verifyBundled.contract";

function verdictLabelForStateRelation(stateRelation: BundledOutcomeCertificate["stateRelation"]): string {
  if (stateRelation === "matches_expectations") return "Reality matches the expectation";
  if (stateRelation === "does_not_match") return "Reality contradicts the claim";
  return "Not determined";
}

function trustStatusPillLabel(stateRelation: BundledOutcomeCertificate["stateRelation"]): string {
  if (stateRelation === "matches_expectations") return "TRUSTED";
  if (stateRelation === "does_not_match") return "NOT TRUSTED";
  return "UNKNOWN";
}

type CertWithSteps = BundledOutcomeCertificate & {
  steps?: Array<{ toolId?: string }>;
};

function failedStepToolId(certificate: BundledOutcomeCertificate): string {
  const steps = (certificate as CertWithSteps).steps;
  const direct = steps?.[0]?.toolId?.trim();
  if (direct) return direct;

  const sorted = [...(certificate.evidenceCompleteness.remediationItems ?? [])].sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  const primary = sorted.find((r) => r.primary) ?? sorted[0];
  const m = primary?.failedCheck?.match(/\(([^)]+)\)\s*$/);
  return (m?.[1] ?? "").trim() || "—";
}

/** Plain-language line for `/verify` demo; stays close to verifier facts without parsing humanReport. */
function verifyDemoPlainExplanation(certificate: BundledOutcomeCertificate): string {
  if (certificate.stateRelation === "matches_expectations") {
    return "Downstream checks matched what the workflow claimed—the outcome certificate is reliable for this verification.";
  }
  if (certificate.stateRelation === "not_established") {
    return "Verification could not establish whether downstream state matched the workflow’s claim.";
  }

  const tool = failedStepToolId(certificate);
  const looksLikeCrmRelated =
    /\bcrm\b/i.test(tool) || /contact/i.test(tool) || tool.includes("salesforce") || tool.includes("hubspot");

  if (looksLikeCrmRelated) {
    return "The workflow claimed it updated a CRM contact, but AgentSkeptic could not verify the expected contact state in the mocked store.";
  }
  return "The workflow made a downstream claim, but the expected state was not verified.";
}

export type CertificateRemediationPanelProps = {
  certificate: BundledOutcomeCertificate;
  /** `verify-demo`: polished summary for the public `/verify` paste page. Default preserves full diagnostic layout for tests/tooling. */
  presentation?: "detailed" | "verify-demo";
};

function VerifyDemoCertificateView(props: { certificate: BundledOutcomeCertificate }) {
  const { certificate } = props;
  const af = certificate.failureSpine.actionableFailure;
  const ec = certificate.evidenceCompleteness;
  const comprehension = deriveVerdictComprehension(certificate as VerdictComprehensionInput);
  const failedStep = failedStepToolId(certificate);
  const evidenceGap = ec.blockerCategory;
  const severity = af.severity;
  const pill = trustStatusPillLabel(certificate.stateRelation);

  const showAutomationBoundary =
    af.automationSafe && af.recommendedAction === "improve_read_connectivity";

  const pillClass =
    certificate.stateRelation === "matches_expectations"
      ? "verify-paste-pill verify-paste-pill--trusted"
      : certificate.stateRelation === "does_not_match"
        ? "verify-paste-pill verify-paste-pill--not-trusted"
        : "verify-paste-pill verify-paste-pill--unknown";

  return (
    <div className="verify-paste-verdict-stack">
      <div className="verify-paste-verdict-card">
        <div className="verify-paste-verdict-head">
          <span className={pillClass} data-testid="verify-paste-trust-pill">
            {pill}
          </span>
        </div>
        <h2 className="verify-paste-verdict-title" data-testid="remediation-verdict-label">
          {verdictLabelForStateRelation(certificate.stateRelation)}
        </h2>
        <p className="verify-paste-plain-explanation">{verifyDemoPlainExplanation(certificate)}</p>

        <dl className="verify-paste-decision-grid">
          <div className="verify-paste-decision-cell">
            <dt>Failed step</dt>
            <dd>
              <code className="verify-paste-mono">{failedStep}</code>
            </dd>
          </div>
          <div className="verify-paste-decision-cell">
            <dt>Evidence gap</dt>
            <dd>
              <code className="verify-paste-mono">{evidenceGap}</code>
            </dd>
          </div>
          <div className="verify-paste-decision-cell">
            <dt>Severity</dt>
            <dd>
              <code className="verify-paste-mono">{severity}</code>
            </dd>
          </div>
          <div className="verify-paste-decision-cell verify-paste-decision-cell--wide">
            <dt>Recommended next action</dt>
            <dd data-testid="verify-paste-demo-next-action">{comprehension.nextAction}</dd>
          </div>
        </dl>

        {showAutomationBoundary ? (
          <p data-testid="remediation-automation-boundary" className="muted verify-paste-automation-boundary u-mt-05">
            {AUTOMATION_BOUNDARY_CONNECTOR}
          </p>
        ) : null}
      </div>

      <section className="verify-paste-why" aria-labelledby="verify-paste-why-heading">
        <h3 id="verify-paste-why-heading">Why this matters</h3>
        <p>
          AgentSkeptic does not treat log lines alone as proof. It checks whether the claimed action lines up with
          downstream reality before marking a run as decision-grade.
        </p>
      </section>
    </div>
  );
}

/** Structured remediation summary for `/api/verify` outcome certificates (presentational; no I/O). */
export function CertificateRemediationPanel(props: CertificateRemediationPanelProps) {
  const { certificate, presentation = "detailed" } = props;

  if (presentation === "verify-demo") {
    return <VerifyDemoCertificateView certificate={certificate} />;
  }

  const af = certificate.failureSpine.actionableFailure;
  const ec = certificate.evidenceCompleteness;
  const primaryLine = deriveVerdictComprehension(certificate as VerdictComprehensionInput).nextAction;
  const remediationItems = [...(ec.remediationItems ?? [])].sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  const showAutomationBoundary =
    af.automationSafe && af.recommendedAction === "improve_read_connectivity";

  return (
    <div className="certificate-remediation-panel">
      <h2 data-testid="remediation-verdict-label">{verdictLabelForStateRelation(certificate.stateRelation)}</h2>
      <p data-testid="remediation-primary-action" className="lede">
        {primaryLine}
      </p>
      {remediationItems.length > 0 ? (
        <div className="remediation-items" data-testid="remediation-items">
          {remediationItems.map((item) => (
            <section key={item.id} className="remediation-item">
              <h3>{item.failedCheck}</h3>
              <dl className="remediation-dl">
                <dt>Action</dt>
                <dd>{item.actionText}</dd>
                <dt>Expected state</dt>
                <dd>{item.expectedState.summary}</dd>
                <dt>Automation</dt>
                <dd>{item.automation.label}</dd>
                <dt>Rerun</dt>
                <dd>{item.rerunPath.readinessLabel}</dd>
                {item.humanReview.required && item.humanReview.decisionPrompt !== undefined ? (
                  <>
                    <dt>Manual review</dt>
                    <dd>{item.humanReview.decisionPrompt}</dd>
                  </>
                ) : null}
              </dl>
            </section>
          ))}
        </div>
      ) : null}
      <dl className="remediation-dl">
        <dt>Failure category</dt>
        <dd>{af.category}</dd>
        <dt>Severity</dt>
        <dd>{af.severity}</dd>
        <dt>Evidence gap</dt>
        <dd>{ec.blockerCategory}</dd>
        {ec.rerunPath !== undefined && remediationItems.length === 0 ? (
          <>
            <dt>Rerun</dt>
            <dd>{ec.rerunPath.readinessLabel}</dd>
          </>
        ) : null}
      </dl>
      {showAutomationBoundary ? (
        <p data-testid="remediation-automation-boundary" className="muted">
          {AUTOMATION_BOUNDARY_CONNECTOR}
        </p>
      ) : null}
    </div>
  );
}
