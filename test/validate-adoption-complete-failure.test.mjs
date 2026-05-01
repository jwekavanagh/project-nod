/**
 * Injected verify failure for scripts/validate-adoption-complete.mjs (ADOPTION_COMPLETE_TEST_BREAK=VERIFY only).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("validate-adoption-complete failure injection", () => {
  it("verify_break_emits_VERIFY_FAILED_and_not_solved_verdict", () => {
    const r = spawnSync(process.execPath, ["scripts/validate-adoption-complete.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ADOPTION_COMPLETE_TEST_BREAK: "VERIFY" },
    });
    assert.equal(r.status, 1, "expected exit 1");
    assert.ok((r.stderr || "").includes("adoption-complete: VERIFY_FAILED"), "stderr marker");
    const verdictPath = join(root, "artifacts", "generated", "adoption-complete-validation-verdict.json");
    const j = JSON.parse(readFileSync(verdictPath, "utf8"));
    assert.equal(j.status, "not_solved");
    assert.equal(j.failure?.code, "VERIFY_FAILED");
    assert.equal(j.checklist["AC-TRUST-01"], false);
    assert.equal(j.checklist["AC-OPS-01"], true);
  });
});
