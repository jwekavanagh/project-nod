import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ARTIFACTS_DIR = path.join(ROOT, "artifacts");

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

export function stableStringify(value) {
  const normalize = (v) => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, normalize(v[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(normalize(value));
}

export function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function canonicalizeForParity(entry) {
  const cloned = JSON.parse(JSON.stringify(entry));
  delete cloned.runtime;
  delete cloned.normalizedHash;
  delete cloned.parityHash;
  if (cloned?.outcome?.evidence) {
    delete cloned.outcome.evidence.elapsedMs;
    delete cloned.outcome.evidence.errorMessage;
    delete cloned.outcome.evidence.stack;
    delete cloned.outcome.evidence.requestId;
    delete cloned.outcome.evidence.connectionId;
  }
  return cloned;
}

export function normalizeReasonCodes(codes) {
  return [...new Set(codes)].sort();
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function expectedScenarios() {
  const filePath = path.join(ROOT, "conformance", "scenarios", "expected-outcomes.json");
  const payload = readJson(filePath);
  return payload.scenarios;
}

