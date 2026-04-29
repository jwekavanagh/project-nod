import { expect, test } from "@playwright/test";

test("Verify page: default payload shows contradiction and human report", async ({ page }) => {
  await page.goto("/verify");
  await page.getByRole("button", { name: "Run verification" }).click();
  await expect(page.getByTestId("verify-page-result")).toBeVisible({ timeout: 60_000 });
  await page.getByText("Reality contradicts the claim").waitFor();
  await page.getByText("Full human report").click();
  const report = page.getByText(/ROW_ABSENT|missing/i).first();
  await expect(report).toBeVisible();
  await expect(page).toHaveURL("/verify");
});
