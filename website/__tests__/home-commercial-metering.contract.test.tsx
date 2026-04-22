/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { productCopy } from "@/content/productCopy";
import { METERING_CLARIFIER } from "@/content/marketingContracts";

describe("homepage commercial strip", () => {
  it("uses benefit-focused homeStrip without GitHub; lead stays the full sign-in / contract clarifier", () => {
    expect(productCopy.commercialSurface.lead).toBe(METERING_CLARIFIER);
    const strip = productCopy.commercialSurface.homeStrip;
    expect(strip).toContain("CI");
    expect(strip).not.toMatch(/github\.com/i);
    render(<p data-testid="home-commercial-metering">{strip}</p>);
    expect(screen.getByTestId("home-commercial-metering")).toHaveTextContent(
      "Run verification in CI",
    );
  });
});
