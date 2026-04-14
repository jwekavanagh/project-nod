/**
 * I1 gate: Quick Verify spec surface locked to 1.2.0 on four files + normative A.13 golden.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("quick-param-pointer version 1.2.0 surfaces", () => {
  it("quickVerifyScope.ts", () => {
    const text = readFileSync(join(root, "src/quickVerify/quickVerifyScope.ts"), "utf8");
    assert.ok(/^export const QUICK_VERIFY_VERSION = "1\.2\.0" as const;$/m.test(text));
    assert.equal(/QUICK_VERIFY_VERSION = "1.1.0"/.test(text), false);
  });

  it("quick-verify-report.schema.json", () => {
    const utf8 = readFileSync(join(root, "schemas/quick-verify-report.schema.json"), "utf8");
    const parsed = JSON.parse(utf8);
    assert.strictEqual(parsed.properties.scope.properties.quickVerifyVersion.const, "1.2.0");
  });

  it("quick-verify-normative.md A.13 + no 1.1.0", () => {
    const normative = readFileSync(join(root, "docs/quick-verify-normative.md"), "utf8");
    const lines = normative.split(/\r?\n/);
    assert.strictEqual(
      lines[2],
      "**Spec id:** `quick-verify-spec` **version:** `1.2.0`",
    );
    const goldenRaw = readFileSync(
      join(root, "test/golden/quick-param-pointer/v1/version-surface/normative-lines-172-173-1-2-0.txt"),
      "utf8",
    );
    const golden = goldenRaw.replace(/\r?\n$/, "");
    assert.strictEqual(lines.slice(171, 173).join("\n"), golden);
    assert.equal(normative.includes("1.1.0"), false);
  });

  it("quick-verify.sqlite.test.mjs literals", () => {
    const text = readFileSync(join(root, "test/quick-verify.sqlite.test.mjs"), "utf8");
    assert.ok(text.includes("assert.equal(report.scope.quickVerifyVersion, \"1.2.0\");"));
    assert.strictEqual(/quickVerifyVersion[^\n]*1\.1\.0/.test(text), false);
  });
});
