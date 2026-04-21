/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReliabilitySignalsView } from "@/app/account/ReliabilitySignalsView";

describe("ReliabilitySignalsView", () => {
  it("renders empty state copy", () => {
    render(<ReliabilitySignalsView data={{ kind: "empty", message: "No licensed verification completions in the last 30 days." }} />);
    expect(screen.getByTestId("reliability-empty").textContent).toContain(
      "No licensed verification completions in the last 30 days.",
    );
  });

  it("renders no-unsafe state with completion count", () => {
    render(
      <ReliabilitySignalsView
        data={{ kind: "no_unsafe", totalCompletions: 12, message: "No unsafe outcomes in the last 30 days." }}
      />,
    );
    expect(screen.getByTestId("reliability-no-unsafe").textContent).toContain("12");
  });

  it("renders three question regions when data is full", () => {
    render(
      <ReliabilitySignalsView
        data={{
          kind: "full",
          totalCompletions: 10,
          unsafeCount: 3,
          unsafeRate: "0.3000",
          topReasonCodes: [{ code: "ROW_ABSENT", count: 2 }],
          topUnsafeWorkflows: [{ workflowId: "wf_x", count: 2 }],
        }}
      />,
    );
    expect(screen.getByText("What failed most often?")).toBeTruthy();
    expect(screen.getByText("Which workflows drove unsafe outcomes?")).toBeTruthy();
    expect(screen.getByText("How often were outcomes unsafe?")).toBeTruthy();
    expect(screen.getByTestId("reliability-rate").textContent).toContain("Unsafe rate: 0.3000 (3 of 10 completions)");
    expect(screen.getByTestId("reliability-reason-table").textContent).toContain("ROW_ABSENT");
    expect(screen.getByTestId("reliability-workflow-table").textContent).toContain("wf_x");
  });
});
