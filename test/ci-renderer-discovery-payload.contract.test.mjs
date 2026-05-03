/**
 * CI PR body renderer: committed goldens for malformed / oversized / operational-only paths.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(import.meta.url);
const dp = require(join(root, "scripts", "discovery-payload.lib.cjs"));

const fixturePath = join(root, "test", "fixtures", "discovery-payload", "v1.json");

function loadFixture() {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

test("malformed stdout golden matches renderCiPrBodyFromPayload", () => {
  const expected = readFileSync(
    join(root, "test/fixtures/ci-renderer/malformed-stdout/expected-pr-body.md"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const out = dp.renderCiPrBodyFromPayload(loadFixture(), {
    stderrText: "",
    workflowStdoutText: "not json",
  });
  assert.equal(out, expected);
  assert.ok(!out.includes("## Failure summary (agentskeptic)"));
  assert.ok(out.includes("## Verification stdout (unparsed)"));
  assert.ok(out.includes("```text\nnot json\n```"));
  assert.ok(out.includes(dp.PR_MARKER_LINE));
});

test("oversized stdout golden matches renderCiPrBodyFromPayload", () => {
  const expected = readFileSync(
    join(root, "test/fixtures/ci-renderer/oversized-stdout/expected-pr-body.md"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const huge = "x".repeat(262145);
  const out = dp.renderCiPrBodyFromPayload(loadFixture(), {
    stderrText: "",
    workflowStdoutText: huge,
  });
  assert.equal(out, expected);
  assert.ok(out.includes("_(stdout exceeded 262144 UTF-8 bytes; failure summary skipped)_"));
  assert.ok(!out.includes("## Failure summary (agentskeptic)"));
});

test("operational stderr-only golden matches renderCiPrBodyFromPayload", () => {
  const expected = readFileSync(
    join(root, "test/fixtures/ci-renderer/operational-only/expected-pr-body.md"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const envLine =
    JSON.stringify({
      schemaVersion: 2,
      kind: "execution_truth_layer_error",
      code: "CLI_USAGE",
      message: "cli msg",
      failureDiagnosis: {
        summary: "op sum",
        primaryOrigin: "workflow_flow",
        confidence: "high",
        evidence: [{ referenceCode: "CLI_USAGE" }],
        actionableFailure: {
          category: "bad_input",
          severity: "low",
          recommendedAction: "fix_cli_usage",
          automationSafe: false,
        },
      },
    }) + "\n";
  const out = dp.renderCiPrBodyFromPayload(loadFixture(), {
    stderrText: envLine,
    workflowStdoutText: "",
  });
  assert.equal(out, expected);
  assert.ok(out.includes("## Failure summary (agentskeptic)"));
  assert.ok(out.includes("trust_decision: unknown"));
});
