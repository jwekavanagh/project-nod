import { expect, test } from "@playwright/test";

test("Try it: deep link runs wf_missing and shows human report", async ({ page }) => {
  await page.goto("/?demo=wf_missing#try-it");
  await expect(page).toHaveURL(/[?&]demo=wf_missing/);
  await page.getByRole("button", { name: "Run sample verification" }).click();
  const report = page.getByTestId("try-truth-report");
  await expect(report).toBeVisible({ timeout: 60_000 });
  await expect(report).not.toBeEmpty();
  await expect.poll(() => new URL(page.url()).searchParams.get("demo")).toBe("wf_missing");
});
