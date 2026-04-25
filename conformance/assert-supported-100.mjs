#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARTIFACTS_DIR, expectedScenarios, readJson } from "./lib.mjs";

const cap = readJson(path.join(ARTIFACTS_DIR, "capabilities", "connector-capabilities.json"));
const supportedScope = readJson(path.join(path.dirname(fileURLToPath(import.meta.url)), "initial-supported-scope.json")).supportedBehaviorIds;
const scenarios = expectedScenarios();

for (const behavior of supportedScope) {
  const capEntry = cap.behaviors.find((b) => b.supportedBehaviorId === behavior);
  if (!capEntry) throw new Error(`missing capability entry: ${behavior}`);
  const mapped = scenarios.filter((s) => s.supportedBehaviorId === behavior);
  if (mapped.length === 0) throw new Error(`SUPPORTED_BEHAVIOR_HAS_ZERO_SCENARIOS: ${behavior}`);
  const hasSuccess = mapped.some((s) => s.expectedStatus === "verified");
  const hasFailure = mapped.some((s) => ["missing", "inconsistent", "partially_verified"].includes(s.expectedStatus));
  const hasDegraded = mapped.some((s) => ["incomplete_verification", "uncertain"].includes(s.expectedStatus));
  if (!hasSuccess || !hasFailure || !hasDegraded) {
    throw new Error(`SUPPORTED_BEHAVIOR_SCENARIO_SHAPE_INCOMPLETE: ${behavior}`);
  }
  if (capEntry.capabilityState !== "supported") {
    throw new Error(`supported scope behavior not supported: ${behavior}`);
  }
}

for (const entry of cap.behaviors) {
  if (entry.supportedBehaviorId.startsWith("bigquery.") && entry.capabilityState !== "unsupported") {
    throw new Error("bigquery behavior marked supported");
  }
}

console.log("supported-scope gate: OK");

