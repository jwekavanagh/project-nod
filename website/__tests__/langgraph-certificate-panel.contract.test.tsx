// @vitest-environment jsdom

import { maybeLangGraphPanelFromCertificate } from "@/components/verification/LangGraphCertificatePanel";
import a2 from "@/content/embeddedReports/langgraph-lct-a2-ineligible.v1.json";
import b from "@/content/embeddedReports/langgraph-lct-b-verified.v1.json";
import d from "@/content/embeddedReports/langgraph-lct-d-incomplete.v1.json";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VerificationReportView } from "@/components/VerificationReportView";

function asV3(cert: object) {
  return {
    schemaVersion: 3 as const,
    certificate: cert as Record<string, unknown>,
  };
}

describe("LangGraph certificate panel (contract)", () => {
  afterEach(() => {
    cleanup();
  });

  it("embed shows langgraph-certificate-panel and checkpoint table for B", () => {
    const human = typeof b.humanReport === "string" ? b.humanReport : "";
    const { container } = render(
      <VerificationReportView humanText={human} payload={asV3(b)} variant="embed" />,
    );
    expect(maybeLangGraphPanelFromCertificate(b)).not.toBeNull();
    expect(container.querySelector('[data-testid="langgraph-certificate-panel"]')).toBeTruthy();
    expect(screen.getByTestId("langgraph-checkpoint-table")).toBeTruthy();
  });

  it("A2 shows no checkpoint table (rollups line only)", () => {
    const human = typeof a2.humanReport === "string" ? a2.humanReport : "";
    render(<VerificationReportView humanText={human} payload={asV3(a2)} variant="embed" />);
    const panel = screen.getByTestId("langgraph-certificate-panel");
    expect(within(panel).queryByTestId("langgraph-checkpoint-table")).toBeNull();
    expect(panel.textContent).toMatch(/No checkpoint rollups/);
  });

  it("D shows checkpoint table", () => {
    const human = typeof d.humanReport === "string" ? d.humanReport : "";
    const { container } = render(
      <VerificationReportView humanText={human} payload={asV3(d)} variant="embed" />,
    );
    expect(container.querySelector('[data-testid="langgraph-checkpoint-table"]')).toBeTruthy();
  });
});
