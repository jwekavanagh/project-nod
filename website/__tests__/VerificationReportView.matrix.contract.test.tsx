/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VerificationReportView } from "@/components/VerificationReportView";
import minimalEnvelope from "@/content/embeddedReports/minimal-share-v3-envelope.json";
import trustedEnvelope from "@/content/embeddedReports/minimal-share-v3-trusted.json";
import unknownEnvelope from "@/content/embeddedReports/minimal-share-v3-unknown.json";
import {
  derivedFieldsFromEnvelope,
  type PublicReportEnvelope,
} from "@/lib/publicVerificationReportService";
import {
  SHARED_REPORT_AUTHORITY_NOTE,
  SHARED_REPORT_LEGACY_ENVELOPE_NOTICE,
  SHARED_REPORT_MALFORMED_CERTIFICATE_NOTICE,
  SHARED_REPORT_NEXT_FALLBACK_NON_TRUSTED,
  SHARED_REPORT_NEXT_TRUSTED,
} from "@/lib/shareReportFallbacks";

function repoRoot(): string {
  const cwd = process.cwd();
  return basename(cwd) === "website" ? join(cwd, "..") : cwd;
}

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

describe("VerificationReportView matrix (v3 envelopes)", () => {
  afterEach(() => {
    cleanup();
  });

  it("matrix A renders verdict, authority, canonical + machine sections", () => {
    const payload = minimalEnvelope as unknown as PublicReportEnvelope;
    const { humanText } = derivedFieldsFromEnvelope(payload);
    render(<VerificationReportView humanText={humanText} payload={payload} variant="standalone" />);
    expect(screen.getByTestId("shared-report-authority-note")).toHaveTextContent(SHARED_REPORT_AUTHORITY_NOTE);
    expect(screen.getByTestId("shared-report-verdict")).toHaveTextContent("Not trusted");
    expect(screen.getByTestId("shared-report-headline")).toHaveTextContent("Fixture headline for share POST v2");
    expect(screen.getByTestId("shared-report-reason")).toHaveTextContent("ROW_ABSENT: Expected row is missing.");
    expect(screen.getByTestId("shared-report-determinacy")).toHaveTextContent(
      "Determinate mismatch: observed state did not match expected state.",
    );
    expect(screen.getByTestId("shared-report-not-checked")).toHaveTextContent(
      "crm.upsert_contact:seq=0: ROW_ABSENT",
    );
    expect(screen.getByTestId("shared-report-missing-inputs")).toHaveTextContent(
      "ROW_ABSENT: Expected row is missing.",
    );
    expect(normWs(screen.getByTestId("verification-report-human").textContent ?? "")).toBe(
      normWs(humanText),
    );
    expect(screen.getByTestId("verification-report-machine")).toContainHTML('"schemaVersion": 3');
    expect(screen.getByRole("heading", { name: /Canonical human report/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Machine JSON \(integration SSOT\)/i })).toBeTruthy();
  });

  it("matrix B trusted shows Trusted and NEXT_TRUSTED text", () => {
    const payload = trustedEnvelope as unknown as PublicReportEnvelope;
    const { humanText } = derivedFieldsFromEnvelope(payload);
    render(<VerificationReportView humanText={humanText} payload={payload} variant="standalone" />);
    expect(screen.getByTestId("shared-report-verdict")).toHaveTextContent("Trusted");
    expect(screen.getByTestId("shared-report-next-action")).toHaveTextContent(SHARED_REPORT_NEXT_TRUSTED);
    expect(screen.getByTestId("shared-report-determinacy")).toHaveTextContent(
      "Determinate match: expected state was verified.",
    );
    expect(screen.getByTestId("shared-report-checked")).toHaveTextContent("crm.upsert_contact:seq=0: verified");
  });

  it("matrix C unknown shows Unknown and fallback next", () => {
    const payload = unknownEnvelope as unknown as PublicReportEnvelope;
    const { humanText } = derivedFieldsFromEnvelope(payload);
    render(<VerificationReportView humanText={humanText} payload={payload} variant="standalone" />);
    expect(screen.getByTestId("shared-report-verdict")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("shared-report-next-action")).toHaveTextContent(SHARED_REPORT_NEXT_FALLBACK_NON_TRUSTED);
    expect(screen.getByTestId("shared-report-determinacy")).toHaveTextContent(
      "Unknown due to evidence blocker: verification_incomplete.",
    );
  });

  it("legacy v1 workflow shows legacy notice only (no executive ids)", () => {
    const p = join(repoRoot(), "website", "src", "content", "embeddedReports", "example-wf-complete.v1.json");
    const payload = JSON.parse(readFileSync(p, "utf8")) as PublicReportEnvelope;
    const { humanText } = derivedFieldsFromEnvelope(payload);
    render(<VerificationReportView humanText={humanText} payload={payload} variant="standalone" />);
    expect(screen.getByTestId("shared-report-legacy-notice")).toHaveTextContent(SHARED_REPORT_LEGACY_ENVELOPE_NOTICE);
    expect(screen.queryByTestId("shared-report-verdict")).toBeNull();
  });

  it("malformed v3 envelope (null certificate) shows malformed notice", () => {
    const payload = { schemaVersion: 3 as const, certificate: null };
    render(
      <VerificationReportView humanText="(none)" payload={payload as unknown as PublicReportEnvelope} variant="standalone" />,
    );
    expect(screen.getByTestId("shared-report-malformed-notice")).toHaveTextContent(
      SHARED_REPORT_MALFORMED_CERTIFICATE_NOTICE,
    );
    expect(screen.queryByTestId("shared-report-verdict")).toBeNull();
  });
});
