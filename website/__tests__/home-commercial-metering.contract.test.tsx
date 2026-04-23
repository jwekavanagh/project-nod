/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getHomeCommercialSectionFromConfig,
  getMeteringClarifier,
  HOME_COMMERCIAL_LEAD,
} from "@/lib/commercialNarrative";

describe("homepage commercial strip", () => {
  it("uses short lead, then strip with clarifier, Starter line, and licensed metering copy", () => {
    const section = getHomeCommercialSectionFromConfig();
    expect(section.lead).toBe(HOME_COMMERCIAL_LEAD);
    expect(section.strip.startsWith(getMeteringClarifier())).toBe(true);
    expect(section.strip).toContain("Starter includes");
    expect(section.strip).toMatch(/docs\/commercial\.md#programmatic-verification-vs-licensed-cli/);
    render(
      <>
        <p data-testid="home-commercial-lead">{section.lead}</p>
        <p data-testid="home-commercial-metering">{section.strip}</p>
      </>,
    );
    expect(screen.getByTestId("home-commercial-metering")).toHaveTextContent("licensed");
  });
});
