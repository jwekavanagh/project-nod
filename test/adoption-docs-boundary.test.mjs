/**
 * Doc boundary checks for adoption golden path (forbidden substrings, retired log bytes).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const EXPECTED_FIRST_RUN_LOG = `# First-run validation log (retired)

This log is retired. Use [golden-path.md](golden-path.md) and [adoption-validation-spec.md](adoption-validation-spec.md).
`;

describe("adoption docs boundary", () => {
  it("golden-path and product SSOT omit banned onboarding phrases", () => {
    const gp = readFileSync(join(root, "docs", "golden-path.md"), "utf8");
    const ssot = readFileSync(join(root, "docs", "verification-product-ssot.md"), "utf8");
    for (const s of [gp, ssot]) {
      assert.equal(s.includes("agentskeptic quick"), false);
      assert.equal(s.includes("workflow-verifier quick"), false);
      assert.equal(s.includes("npm run first-run"), false);
    }
    assert.equal(gp.toLowerCase().includes("enforce"), false);
  });

  it("first-run-validation-log.md matches retired bytes (LF, no BOM)", () => {
    const p = join(root, "docs", "first-run-validation-log.md");
    const buf = readFileSync(p);
    assert.equal(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, false, "no UTF-8 BOM");
    assert.equal(readFileSync(p, "utf8").replace(/\r\n/g, "\n"), EXPECTED_FIRST_RUN_LOG);
  });
});
