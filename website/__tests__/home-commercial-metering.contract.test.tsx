/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getHomeCommercialSectionFromConfig,
  HOME_COMMERCIAL_FOLLOW,
  HOME_COMMERCIAL_LEAD,
} from "@/lib/commercialNarrative";

describe("homepage commercial strip", () => {
  it("uses short lede, follow line, and in-process vs licensed copy", () => {
    const section = getHomeCommercialSectionFromConfig();
    expect(section.lead).toBe(HOME_COMMERCIAL_LEAD);
    expect(section.strip).toBe(HOME_COMMERCIAL_FOLLOW);
    expect(section.lead.toLowerCase()).toContain("createdecisiongate");
    expect(section.strip).toMatch(/docs\/commercial\.md/);
    render(
      <>
        <p data-testid="home-commercial-lead">{section.lead}</p>
        <p data-testid="home-commercial-metering">{section.strip}</p>
      </>,
    );
    expect(screen.getByTestId("home-commercial-metering")).toHaveTextContent("commercial");
  });
});
