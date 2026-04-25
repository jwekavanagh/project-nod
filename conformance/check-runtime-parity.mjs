#!/usr/bin/env node
import path from "node:path";
import { ARTIFACTS_DIR, expectedScenarios, readJson, writeJson } from "./lib.mjs";

const ts = readJson(path.join(ARTIFACTS_DIR, "conformance", "typescript", "canonical.json")).results;
const py = readJson(path.join(ARTIFACTS_DIR, "conformance", "python", "canonical.json")).results;
const expected = expectedScenarios();

const tsMap = new Map(ts.map((r) => [r.scenarioId, r]));
const pyMap = new Map(py.map((r) => [r.scenarioId, r]));
const diffs = [];
for (const s of expected) {
  if (!s.mustMatchRuntime) continue;
  const a = tsMap.get(s.scenarioId);
  const b = pyMap.get(s.scenarioId);
  if (!a || !b) {
    diffs.push({ scenarioId: s.scenarioId, reason: "missing_runtime_result" });
    continue;
  }
  if (a.parityHash !== b.parityHash) {
    diffs.push({ scenarioId: s.scenarioId, reason: "parity_hash_mismatch", ts: a.parityHash, py: b.parityHash });
  }
}

const out = { diffCount: diffs.length, diffs };
writeJson(path.join(ARTIFACTS_DIR, "parity", "runtime-parity.json"), out);
if (diffs.length > 0) {
  throw new Error(`runtime parity failed for ${diffs.length} supported scenarios`);
}
console.log("runtime parity: OK");

