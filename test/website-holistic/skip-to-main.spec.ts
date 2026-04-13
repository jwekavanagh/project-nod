import { expect, test } from "@playwright/test";

test("skip link moves focus to #site-main", async ({ page }) => {
  await page.goto("/");
  await page.locator(".skip-to-main").click();
  await expect(page.locator("#site-main")).toBeFocused();
});
