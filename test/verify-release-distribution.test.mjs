/**
 * T5: runReleaseVerify with stubs + source contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  RETRY_MAX_ROUNDS,
  RETRY_DELAY_MS,
  runReleaseVerify,
} from "../scripts/verify-release-distribution.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(root, "scripts", "verify-release-distribution.mjs");

describe("verify-release-distribution", () => {
  it("contract: script contains required policy and commands (T5d)", () => {
    const s = readFileSync(srcPath, "utf8");
    assert.ok(s.includes("6"), "RETRY count 6");
    assert.ok(s.includes("10000"), "RETRY_DELAY_MS 10000");
    assert.ok(/gh\s+release\s+view/.test(s), "gh release view");
    assert.ok(s.includes("npm view") || s.includes("npm") && s.includes("view"), "npm view");
    assert.ok(s.includes("agentskeptic"), "package name");
    assert.ok(s.includes("pypi.org/pypi/"), "pypi url");
  });

  it("succeeds first round when all three checks pass (T5a, T5c)", async () => {
    const r = await runReleaseVerify({
      expected: "1.0.0",
      roundDelayMs: 0,
      checkNpm: async () => ({ ok: true, last: "npm=1.0.0" }),
      checkPypi: async () => ({ ok: true, last: "pypi=1.0.0" }),
      checkGh: async () => ({ ok: true, last: "tag=v1.0.0" }),
    });
    assert.equal(r.success, true);
    assert.ok(
      r.line && r.line.startsWith("verify-release-distribution: ok"),
      r.line,
    );
  });

  it("fails after maxRounds when npm always fails (T5b)", async () => {
    const r = await runReleaseVerify({
      expected: "1.0.0",
      maxRounds: RETRY_MAX_ROUNDS,
      roundDelayMs: 0,
      checkNpm: async () => ({ ok: false, last: "npm: nope" }),
      checkPypi: async () => ({ ok: true, last: "pypi=1.0.0" }),
      checkGh: async () => ({ ok: true, last: "tag=v1.0.0" }),
    });
    assert.equal(r.success, false);
  });
});
