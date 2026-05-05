import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const root = join(fileURLToPath(import.meta.url), "..", "..", "..");
const expected = JSON.parse(
  readFileSync(join(root, "test/fixtures/debug-ui-compare/expected-strings.json"), "utf8"),
) as { executionPathEmpty: string; executionPathFindingCode: string };

test("AC_10_4_execution_path", async ({ page }) => {
  await page.goto("/");
  const nonemptyDetail = page.waitForResponse(
    (r) => r.url().includes("/api/runs/run_path_nonempty") && r.status() === 200,
  );
  await page.getByRole("button", { name: "run_path_nonempty" }).click();
  await nonemptyDetail;
  await expect(
    page.locator(`[data-etl-finding-code="${expected.executionPathFindingCode}"]`),
  ).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  const emptyDetail = page.waitForResponse(
    (r) => r.url().includes("/api/runs/run_path_empty") && r.status() === 200,
  );
  await page.getByRole("button", { name: "run_path_empty" }).click();
  await emptyDetail;
  const emptyP = page.locator("[data-etl-execution-path-empty]");
  await expect(emptyP).toBeVisible();
  await expect(emptyP).toHaveText(expected.executionPathEmpty);
});
