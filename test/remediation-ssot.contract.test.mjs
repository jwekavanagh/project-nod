/**
 * §3.2a — remediation SSOT: evidenceCompleteness imports remediationMessage; single Record owner.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ecPath = join(root, "src", "evidenceCompleteness.ts");
const rmPath = join(root, "src", "remediationMessage.ts");

test("evidenceCompleteness imports remediationMessage", () => {
  const t = readFileSync(ecPath, "utf8");
  assert.ok(t.includes('from "./remediationMessage.js"'), "expected import from remediationMessage.js");
  assert.ok(t.includes("remediationMessageForRecommendedAction("), "expected helper invocation");
  assert.ok(!t.includes("REMEDIATION_LINE"), "REMEDIATION_LINE must not remain in evidenceCompleteness.ts");
});

test("remediationMessage.ts defines exhaustive Record<RecommendedActionCode", () => {
  const t = readFileSync(rmPath, "utf8");
  assert.ok(t.includes("Record<RecommendedActionCode"), "expected Record<RecommendedActionCode> map");
});
