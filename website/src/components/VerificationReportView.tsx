import { productCopy } from "@/content/productCopy";
import { maybeLangGraphPanelFromCertificate } from "@/components/verification/LangGraphCertificatePanel";
import type { PublicReportEnvelope } from "@/lib/publicVerificationReportService";

type Props = {
  humanText: string;
  payload: PublicReportEnvelope;
  variant: "standalone" | "embed";
};

function machineJsonFromPayload(payload: PublicReportEnvelope): string {
  if ("schemaVersion" in payload && payload.schemaVersion === 3) {
    return JSON.stringify(payload.certificate, null, 2);
  }
  if ("kind" in payload && payload.kind === "workflow") {
    return JSON.stringify(payload.workflowResult, null, 2);
  }
  if ("kind" in payload && payload.kind === "quick") {
    return JSON.stringify(payload.quickReport, null, 2);
  }
  return JSON.stringify(payload, null, 2);
}

function kindLabel(payload: PublicReportEnvelope): string {
  if ("schemaVersion" in payload && payload.schemaVersion === 3) return "outcome_certificate";
  if ("kind" in payload) return payload.kind;
  return "unknown";
}

export function VerificationReportView({ humanText, payload, variant }: Props) {
  const machineJson = machineJsonFromPayload(payload);
  const kind = kindLabel(payload);
  const langPanel =
    "schemaVersion" in payload && payload.schemaVersion === 3
      ? maybeLangGraphPanelFromCertificate(
          (payload as { schemaVersion: 3; certificate: unknown }).certificate,
        )
      : null;
  if (variant === "embed") {
    return (
      <section className="verification-report-embed" data-testid="verification-report-embed">
        <h2 className="verification-report-embed-title">Verification report</h2>
        <p className="muted">{productCopy.publicShareReportIntro}</p>
        <p className="muted">
          Kind: <strong>{kind}</strong>
        </p>
        {langPanel}
        <section className="home-section" aria-labelledby="human-heading-embed">
          <h2 id="human-heading-embed">Human report</h2>
          <pre className="truth-report-pre" data-testid="verification-report-human">
            {humanText}
          </pre>
        </section>
        <section className="home-section" aria-labelledby="machine-heading-embed">
          <h2 id="machine-heading-embed">Machine JSON</h2>
          <pre className="truth-report-pre" data-testid="verification-report-machine">
            {machineJson}
          </pre>
        </section>
      </section>
    );
  }
  return (
    <article className="integrate-main" data-testid="verification-report-view">
      <h1>Verification report</h1>
      <p className="muted">{productCopy.publicShareReportIntro}</p>
      <p className="muted">
        Kind: <strong>{kind}</strong>
      </p>
      {langPanel}
      <section className="home-section" aria-labelledby="human-heading">
        <h2 id="human-heading">Human report</h2>
        <pre className="truth-report-pre" data-testid="verification-report-human">
          {humanText}
        </pre>
      </section>
      <section className="home-section" aria-labelledby="machine-heading">
        <h2 id="machine-heading">Machine JSON</h2>
        <pre className="truth-report-pre" data-testid="verification-report-machine">
          {machineJson}
        </pre>
      </section>
    </article>
  );
}
