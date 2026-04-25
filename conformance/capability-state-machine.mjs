#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARTIFACTS_DIR, expectedScenarios, readJson, writeJson } from "./lib.mjs";

const supportedScope = readJson(path.join(path.dirname(fileURLToPath(import.meta.url)), "initial-supported-scope.json")).supportedBehaviorIds;
const ts = readJson(path.join(ARTIFACTS_DIR, "conformance", "typescript", "all.json")).results;
const py = readJson(path.join(ARTIFACTS_DIR, "conformance", "python", "all.json")).results;
const parity = readJson(path.join(ARTIFACTS_DIR, "parity", "runtime-parity.json"));
const scenarios = expectedScenarios();

const tsById = new Map(ts.map((r) => [r.scenarioId, r]));
const pyById = new Map(py.map((r) => [r.scenarioId, r]));
const parityFailed = new Set((parity.diffs ?? []).map((d) => d.scenarioId));
const scenarioByBehavior = new Map();
for (const s of scenarios) {
  const arr = scenarioByBehavior.get(s.supportedBehaviorId) ?? [];
  arr.push(s);
  scenarioByBehavior.set(s.supportedBehaviorId, arr);
}

const behaviors = [...new Set(scenarios.map((s) => s.supportedBehaviorId))].sort().map((behaviorId) => {
  const sc = scenarioByBehavior.get(behaviorId) ?? [];
  const tsSupported = evaluateRuntime(sc, tsById, parityFailed, true);
  const pySupported = evaluateRuntime(sc, pyById, parityFailed, false);
  const inSupportedScope = supportedScope.includes(behaviorId);
  const capabilityState = inSupportedScope && tsSupported && pySupported ? "supported" : "unsupported";
  return {
    supportedBehaviorId: behaviorId,
    capabilityState,
    runtimeStates: {
      typescript: tsSupported ? "supported" : "unsupported",
      python: pySupported ? "supported" : "unsupported",
    },
    scenarioIds: sc.map((s) => s.scenarioId),
  };
});

const out = {
  generatedAt: new Date().toISOString(),
  behaviors,
};
writeJson(path.join(ARTIFACTS_DIR, "capabilities", "connector-capabilities.json"), out);
console.log(`capability states generated for ${behaviors.length} behaviors`);

function evaluateRuntime(scenariosForBehavior, runtimeMap, parityFailed, requireParity) {
  if (scenariosForBehavior.length === 0) return false;
  for (const scenario of scenariosForBehavior) {
    const r = runtimeMap.get(scenario.scenarioId);
    if (!r) return false;
    if (r.outcome.status !== scenario.expectedStatus) return false;
    if (JSON.stringify(r.outcome.reasonCodes) !== JSON.stringify([...scenario.expectedReasonCodes].sort())) return false;
    if (requireParity && scenario.mustMatchRuntime && parityFailed.has(scenario.scenarioId)) return false;
  }
  return true;
}

