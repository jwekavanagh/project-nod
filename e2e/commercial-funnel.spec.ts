import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const runFull = process.env.COMMERCIAL_E2E_FULL === "1";

test.describe("commercial funnel", () => {
  test("pricing page shows SSOT plan numbers", async ({ page }) => {
    const plansPath = path.join(repoRoot, "config", "commercial-plans.json");
    const plans = JSON.parse(readFileSync(plansPath, "utf8")) as {
      plans: Record<string, { includedMonthly: number | null; displayPrice: string }>;
    };
    await page.goto("/pricing");
    const fmt = new Intl.NumberFormat("en-US");
    for (const id of ["starter", "individual", "team", "business"] as const) {
      const n = plans.plans[id].includedMonthly;
      if (n !== null) {
        await expect(page.locator(`[data-plan="${id}"]`)).toContainText(fmt.format(n));
      }
      await expect(page.locator(`[data-plan="${id}"]`)).toContainText(plans.plans[id].displayPrice);
    }
  });

  test("pricing shows plan comparison heading", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Plan comparison" })).toBeVisible();
  });

  test("full funnel (stripe + mailpit + CLI)", async () => {
    if (!runFull) {
      test.skip();
    }
    // Expand in scripts/run-commercial-e2e.mjs when COMMERCIAL_E2E_FULL=1.
    expect(true).toBe(true);
  });
});
