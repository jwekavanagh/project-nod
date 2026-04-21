/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingCompareTable } from "@/app/pricing/PricingCompareTable";
import { PRICING_FEATURE_COMPARISON, type PlanColumn } from "@/content/marketingContracts";

describe("PricingCompareTable contract", () => {
  it("renders every comparison cell exactly as authored", () => {
    render(<PricingCompareTable />);
    const region = screen.getByTestId("pricing-compare-section");
    const table = within(region).getByRole("table");

    for (const row of PRICING_FEATURE_COMPARISON.rows) {
      const rowHeader = within(table).getByRole("rowheader", { name: row.feature });
      const tr = rowHeader.closest("tr");
      expect(tr).toBeTruthy();
      const cells = within(tr!).getAllByRole("cell");
      const planOrder: PlanColumn[] = ["starter", "individual", "team", "business", "enterprise"];
      expect(cells).toHaveLength(planOrder.length);
      planOrder.forEach((plan, i) => {
        expect(cells[i]).toHaveTextContent(row[plan]);
      });
    }
  });
});
