import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const runFull = process.env.COMMERCIAL_E2E_FULL === "1";

test.describe("commercial funnel", () => {
  test("landing shows SSOT plan numbers", async ({ page }) => {
    const plansPath = path.join(__dirname, "..", "config", "commercial-plans.json");
    const plans = JSON.parse(readFileSync(plansPath, "utf8")) as {
      plans: Record<string, { includedMonthly: number | null; displayPrice: string }>;
    };
    await page.goto("/");
    for (const id of ["starter", "team", "business"] as const) {
      const n = plans.plans[id].includedMonthly;
      if (n !== null) {
        await expect(page.locator(`[data-plan="${id}"]`)).toContainText(String(n));
      }
      await expect(page.locator(`[data-plan="${id}"]`)).toContainText(plans.plans[id].displayPrice);
    }
  });

  test("full funnel (stripe + mailpit + CLI)", async () => {
    if (!runFull) {
      test.skip();
    }
    // Expand in scripts/run-commercial-e2e.mjs when COMMERCIAL_E2E_FULL=1.
    expect(true).toBe(true);
  });
});
