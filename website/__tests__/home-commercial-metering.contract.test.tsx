/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getHomeCommercialSectionFromConfig,
  HOME_COMMERCIAL_BOUNDARY_DOCS,
  HOME_COMMERCIAL_LEAD,
} from "@/lib/commercialNarrative";

describe("homepage commercial strip", () => {
  it("uses lede, linked boundary line, and in-process local copy in lede", () => {
    const section = getHomeCommercialSectionFromConfig();
    expect(section.lead).toBe(HOME_COMMERCIAL_LEAD);
    expect(section.strip).toBe("");
    expect(section.lead.toLowerCase()).toContain("createdecisiongate");
    render(
      <>
        <p data-testid="home-commercial-lead">{section.lead}</p>
        <p data-testid="home-commercial-boundary">
          <a href={HOME_COMMERCIAL_BOUNDARY_DOCS.href} rel="noreferrer" target="_blank">
            {HOME_COMMERCIAL_BOUNDARY_DOCS.label}
          </a>
        </p>
      </>,
    );
    const boundary = screen.getByTestId("home-commercial-boundary");
    expect(boundary).toHaveTextContent("See the commercial boundary docs.");
    const a = boundary.querySelector("a");
    expect(a?.getAttribute("href")).toBe(HOME_COMMERCIAL_BOUNDARY_DOCS.href);
  });
});
