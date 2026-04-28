/**
 * Node-side contract: website gate JSON lists exist and every entry is a resolvable __tests__ path.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webTests = join(__dirname, "..", "website", "__tests__");

function readGate(name) {
  return JSON.parse(readFileSync(join(webTests, name), "utf8"));
}

function assertGateJson(jsonName) {
  const list = readGate(jsonName);
  assert.ok(list.length >= 1, `${jsonName}: expected at least one module`);
  for (const rel of list) {
    assert.equal(typeof rel, "string");
    const p = join(webTests, rel.replace(/^\.\//, ""));
    assert.equal(existsSync(p), true, `${jsonName} → ${rel}`);
  }
}

describe("website gate module JSON (SSOT for verification-truth-stages Vitest arg lists)", () => {
  it("ci-website-gate.modules.json", () => {
    assertGateJson("ci-website-gate.modules.json");
  });
  it("decision-readiness-gate.modules.json", () => {
    assertGateJson("decision-readiness-gate.modules.json");
  });
});
