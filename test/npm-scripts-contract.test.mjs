/**
 * Enforces npm script shape for post-audit single-gate CI (package.json only).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function countValidateTtfv(s) {
  return (s.match(/validate-ttfv/g) || []).length;
}

describe("npm scripts contract (test / test:ci)", () => {
  it("scripts.test contains exactly one validate-ttfv token", () => {
    assert.equal(countValidateTtfv(pkg.scripts.test), 1);
  });

  it("scripts.test:ci contains exactly one validate-ttfv token", () => {
    assert.equal(countValidateTtfv(pkg.scripts["test:ci"]), 1);
  });

  it("scripts.test must not reference removed quick-verify-contract or quick-verify-sql-allowlist", () => {
    assert.equal(pkg.scripts.test.includes("quick-verify-contract"), false);
    assert.equal(pkg.scripts.test.includes("quick-verify-sql-allowlist"), false);
  });

  it("scripts.test:ci must not reference removed scripts", () => {
    assert.equal(pkg.scripts["test:ci"].includes("quick-verify-contract"), false);
    assert.equal(pkg.scripts["test:ci"].includes("quick-verify-sql-allowlist"), false);
  });

  it("test:ci must run first-run for CI parity with local onboarding smoke", () => {
    assert.equal(pkg.scripts["test:ci"].includes("first-run"), true);
  });

  it("test must still run first-run for local onboarding smoke", () => {
    assert.equal(pkg.scripts.test.includes("first-run"), true);
  });

  it("scripts.test runs root vitest before filtered LangGraph primacy website vitest", () => {
    const s = pkg.scripts.test;
    const a = s.indexOf("npm run test:vitest");
    const b = s.indexOf("langgraph-reference-primacy.dom.test.tsx");
    assert.ok(a !== -1 && b !== -1 && a < b);
  });

  it("scripts.test:ci runs root vitest before filtered LangGraph primacy website vitest", () => {
    const s = pkg.scripts["test:ci"];
    const a = s.indexOf("npm run test:vitest");
    const b = s.indexOf("langgraph-reference-primacy.dom.test.tsx");
    assert.ok(a !== -1 && b !== -1 && a < b);
  });

  it("scripts.test runs partner-quickstart before langgraph-reference-verify driver", () => {
    const s = pkg.scripts.test;
    const a = s.indexOf("npm run partner-quickstart");
    const b = s.indexOf("node scripts/langgraph-reference-verify.mjs");
    assert.ok(a !== -1 && b !== -1 && a < b);
  });

  it("scripts.test:ci runs partner-quickstart before langgraph-reference-verify driver", () => {
    const s = pkg.scripts["test:ci"];
    const a = s.indexOf("npm run partner-quickstart");
    const b = s.indexOf("node scripts/langgraph-reference-verify.mjs");
    assert.ok(a !== -1 && b !== -1 && a < b);
  });

  it("scripts.test includes exactly one filtered LangGraph primacy vitest and one langgraph driver", () => {
    const s = pkg.scripts.test;
    assert.equal((s.match(/langgraph-reference-primacy\.dom\.test\.tsx/g) || []).length, 1);
    assert.equal((s.match(/node scripts\/langgraph-reference-verify\.mjs/g) || []).length, 1);
  });

  it("scripts.test:ci includes exactly one filtered LangGraph primacy vitest and one langgraph driver", () => {
    const s = pkg.scripts["test:ci"];
    assert.equal((s.match(/langgraph-reference-primacy\.dom\.test\.tsx/g) || []).length, 1);
    assert.equal((s.match(/node scripts\/langgraph-reference-verify\.mjs/g) || []).length, 1);
  });
});
