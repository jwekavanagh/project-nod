"use client";

import { AUTOMATION_BOUNDARY_CONNECTOR } from "@/lib/automationBoundaryConnector";
import type { BundledOutcomeCertificate } from "@/lib/verifyBundled.contract";

function verdictLabelForStateRelation(stateRelation: BundledOutcomeCertificate["stateRelation"]): string {
  if (stateRelation === "matches_expectations") return "Reality matches the expectation";
  if (stateRelation === "does_not_match") return "Reality contradicts the claim";
  return "Not determined";
}

export type CertificateRemediationPanelProps = {
  certificate: BundledOutcomeCertificate;
};

/** Structured remediation summary for `/api/verify` outcome certificates (presentational; no I/O). */
export function CertificateRemediationPanel(props: CertificateRemediationPanelProps) {
  const { certificate } = props;
  const af = certificate.failureSpine.actionableFailure;
  const ec = certificate.evidenceCompleteness;
  const primaryLine = ec.nextActions[0]?.text ?? "";
  const showAutomationBoundary =
    af.automationSafe && af.recommendedAction === "improve_read_connectivity";

  return (
    <div className="certificate-remediation-panel">
      <h2 data-testid="remediation-verdict-label">{verdictLabelForStateRelation(certificate.stateRelation)}</h2>
      <p data-testid="remediation-primary-action" className="lede">
        {primaryLine}
      </p>
      <dl className="remediation-dl">
        <dt>Failure category</dt>
        <dd>{af.category}</dd>
        <dt>Severity</dt>
        <dd>{af.severity}</dd>
        <dt>Recommended action</dt>
        <dd>
          <code>{af.recommendedAction}</code>
        </dd>
        <dt>Automation-safe</dt>
        <dd>{af.automationSafe ? "yes" : "no"}</dd>
        <dt>Evidence gap</dt>
        <dd>{ec.blockerCategory}</dd>
        {ec.rerunReadiness !== undefined ? (
          <>
            <dt>Rerun readiness</dt>
            <dd>{ec.rerunReadiness}</dd>
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
