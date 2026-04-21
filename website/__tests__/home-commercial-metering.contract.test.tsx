/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { productCopy } from "@/content/productCopy";
import { METERING_CLARIFIER } from "@/content/marketingContracts";

describe("homepage commercial metering strip", () => {
  it("shows the metering clarifier verbatim from marketingContracts", () => {
    expect(productCopy.commercialSurface.lead).toBe(METERING_CLARIFIER);
    render(
      <p data-testid="home-commercial-metering">{productCopy.commercialSurface.lead}</p>,
    );
    expect(screen.getByTestId("home-commercial-metering")).toHaveTextContent(METERING_CLARIFIER);
  });
});
