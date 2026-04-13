import { expect, test, type Page } from "@playwright/test";

async function assertOutlineAtLeast2px(page: Page, locator: ReturnType<Page["locator"]>) {
  const ok = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    const w = parseFloat(s.outlineWidth);
    return s.outlineStyle !== "none" && !Number.isNaN(w) && w >= 2;
  });
  expect(ok).toBe(true);
}

async function tabUntil(page: Page, maxTabs: number, check: () => Promise<boolean>) {
  for (let i = 0; i < maxTabs; i++) {
    if (await check()) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("tabUntil: condition not met within max tabs");
}

test("focus-visible outline on representative tab stops", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skip = page.locator(".skip-to-main");
  await expect(skip).toBeFocused();
  await assertOutlineAtLeast2px(page, skip);

  await tabUntil(page, 40, async () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return Boolean(el && "matches" in el && (el as Element).matches(".site-nav a"));
    }),
  );
  const navLink = page.locator(".site-nav a").first();
  await expect(navLink).toBeFocused();
  await assertOutlineAtLeast2px(page, navLink);

  await tabUntil(page, 45, async () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return Boolean(el && "matches" in el && (el as Element).matches("main a.btn"));
    }),
  );
  const heroBtn = page.locator("main a.btn").first();
  await expect(heroBtn).toBeFocused();
  await assertOutlineAtLeast2px(page, heroBtn);
});
