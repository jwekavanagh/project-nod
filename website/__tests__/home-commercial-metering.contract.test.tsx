/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { productCopy } from "@/content/productCopy";
import { HOME_COMMERCIAL_STRIP_LEAD, METERING_CLARIFIER } from "@/content/marketingContracts";

describe("homepage commercial metering strip", () => {
  it("homepage uses short home strip; lead stays the full sign-in / contract clarifier", () => {
    expect(productCopy.commercialSurface.lead).toBe(METERING_CLARIFIER);
    expect(productCopy.commercialSurface.homeStrip).toBe(HOME_COMMERCIAL_STRIP_LEAD);
    render(
      <p data-testid="home-commercial-metering">{productCopy.commercialSurface.homeStrip}</p>,
    );
    expect(screen.getByTestId("home-commercial-metering")).toHaveTextContent(
      HOME_COMMERCIAL_STRIP_LEAD,
    );
  });
});
