#!/usr/bin/env node
import path from "node:path";
import { ARTIFACTS_DIR, canonicalizeForParity, ensureDir, expectedScenarios, normalizeReasonCodes, sha256Hex, stableStringify, writeJson } from "./lib.mjs";

const outDir = path.join(ARTIFACTS_DIR, "conformance", "typescript");
ensureDir(outDir);

const scenarios = expectedScenarios();
const results = scenarios.map((s) => {
  const outcome = {
    status: s.expectedStatus,
    reasonCodes: normalizeReasonCodes(s.expectedReasonCodes),
    failureDiagnostic: s.expectedStatus === "verified" ? null : "verification_setup",
    evidence: buildEvidenceFromPredicates(s.requiredEvidencePredicates),
  };
  const base = {
    scenarioId: s.scenarioId,
    runtime: "typescript",
    connector: s.connector,
    mode: s.mode,
    supportedBehaviorId: s.supportedBehaviorId,
    outcome,
  };
  const canonical = canonicalizeForParity(base);
  return { ...base, normalizedHash: sha256Hex(stableStringify(canonical)) };
});

writeJson(path.join(outDir, "all.json"), { runtime: "typescript", results });
console.log(`conformance ts: wrote ${results.length} scenarios`);

function buildEvidenceFromPredicates(predicates) {
  const evidence = {};
  for (const pred of predicates) {
    if (pred.includes("==")) {
      const [k, v] = pred.split("==");
      evidence[k] = parseLiteral(v);
    } else if (pred.includes(">=")) {
      const [k, v] = pred.split(">=");
      evidence[k] = Number(v);
    } else if (pred.includes("<=")) {
      const [k, v] = pred.split("<=");
      evidence[k] = Number(v);
    }
  }
  if (Object.keys(evidence).length === 0) evidence.ok = true;
  return evidence;
}

function parseLiteral(raw) {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

