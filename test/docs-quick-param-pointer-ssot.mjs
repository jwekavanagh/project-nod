/**
 * I8: normative + product SSOT mention predicate once; normative includes merge golden; README link + forbidden strings.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function countSubstring(haystack, needle) {
  let c = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    c++;
    i += needle.length;
  }
  return c;
}

describe("docs quick-param-pointer SSOT", () => {
  it("normative + product + README contracts", () => {
    const normative = readFileSync(join(root, "docs/quick-verify-normative.md"), "utf8");
    const product = readFileSync(join(root, "docs/verification-product-ssot.md"), "utf8");
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const needle = "eligible_export_sql_row_param_pointer";
    assert.strictEqual(countSubstring(normative, needle), 1);
    assert.strictEqual(
      countSubstring(product, needle),
      0,
      "verification-product-ssot.md must not name implementation predicates; see quick-verify-normative + operational notes",
    );
    const merge = readFileSync(
      join(root, "test/golden/quick-param-pointer/v1/normative-merge-section.md"),
      "utf8",
    ).trim();
    assert.strictEqual(normative.replace(/\r\n/g, "\n").includes(merge), true);
    const plain = "[docs/verification-product-ssot.md](docs/verification-product-ssot.md)";
    const bold = "[`docs/verification-product-ssot.md`](docs/verification-product-ssot.md)";
    assert.ok(countSubstring(readme, plain) + countSubstring(readme, bold) >= 1);
    const forbidden = [
      "eligible_export_sql_row_param_pointer",
      "normalizedSqlRowRequestFingerprint",
      "buildSyntheticRowParams",
      "test/fixtures/quick-param-pointer",
    ];
    for (const f of forbidden) {
      assert.strictEqual(countSubstring(readme, f), 0, `README must not contain ${f}`);
    }
  });
});
