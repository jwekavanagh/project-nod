type VerifyVerdictLabel =
  | "Reality matches the expectation"
  | "Reality contradicts the claim"
  | "Not determined";

type CertificateLike = {
  stateRelation?: unknown;
  explanation?: { headline?: unknown; details?: Array<{ code?: unknown }> } | unknown;
};

function normalizeHeadline(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function buildCertificateLaySummary(
  certificate: unknown,
  humanReport: string,
): { verdictLabel: VerifyVerdictLabel; contradictionLine: string } {
  const cert = (certificate ?? {}) as CertificateLike;
  const relation = cert.stateRelation;
  const verdictLabel: VerifyVerdictLabel =
    relation === "matches_expectations"
      ? "Reality matches the expectation"
      : relation === "does_not_match"
        ? "Reality contradicts the claim"
        : "Not determined";

  const explanation = cert.explanation as { headline?: unknown; details?: Array<{ code?: unknown }> } | undefined;
  const head = normalizeHeadline(explanation?.headline);
  const firstCode = explanation?.details?.[0]?.code;
  const report = humanReport.trim();

  if (head) {
    return { verdictLabel, contradictionLine: head };
  }
  if (relation === "does_not_match" && firstCode === "ROW_ABSENT") {
    return {
      verdictLabel,
      contradictionLine: "The workflow claims a CRM upsert, but the expected row is missing.",
    };
  }
  if (report.length > 0) {
    return { verdictLabel, contradictionLine: report.split(/\r?\n/)[0] ?? report };
  }
  return {
    verdictLabel,
    contradictionLine: "The observed state does not establish the expected outcome.",
  };
}
