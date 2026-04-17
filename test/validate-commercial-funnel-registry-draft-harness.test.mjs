/**
 * Proves `scripts/validate-commercial-funnel.mjs` wires registry-draft harness after OSS restore build.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const scriptPath = join(root, "scripts", "validate-commercial-funnel.mjs");

describe("validate-commercial-funnel registry-draft harness", () => {
  it("places postPackSmokeOssRestore markers before a single runRegistryDraftOutcomeHarness call", () => {
    const src = readFileSync(scriptPath, "utf8");
    const idxPhase = src.indexOf("// PHASE:postPackSmokeOssRestoreBuild");
    const idxBuild = src.indexOf("// BUILD:postPackSmokeOssRestore");
    const idxHarnessFn = src.indexOf("function runRegistryDraftOutcomeHarness");
    const idxHarnessCall = src.indexOf("runRegistryDraftOutcomeHarness(root)");
    const idxInner = src.indexOf("// REGISTRY_DRAFT_OUTCOME_HARNESS");

    assert.ok(idxPhase >= 0, "PHASE marker missing");
    assert.ok(idxBuild >= 0, "BUILD marker missing");
    assert.ok(idxHarnessFn >= 0, "runRegistryDraftOutcomeHarness definition missing");
    assert.ok(idxHarnessCall >= 0, "runRegistryDraftOutcomeHarness(root) call missing");
    assert.ok(idxInner >= 0, "REGISTRY_DRAFT_OUTCOME_HARNESS marker missing");

    assert.ok(idxBuild < idxPhase || idxPhase < idxBuild + 200, "phase/build markers should be adjacent block");
    assert.ok(idxPhase < idxHarnessCall, "phase marker must precede harness call");
    assert.ok(idxHarnessFn > idxHarnessCall, "harness function definition must appear after its call site");

    const calls = src.match(/runRegistryDraftOutcomeHarness\(root\)/g);
    assert.equal(calls?.length, 1, "expected exactly one harness invocation");

    const defs = src.match(/function runRegistryDraftOutcomeHarness/g);
    assert.equal(defs?.length, 1, "expected exactly one harness function");
  });
});
