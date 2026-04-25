#!/usr/bin/env node
import path from "node:path";
import { ARTIFACTS_DIR, canonicalizeForParity, readJson, sha256Hex, stableStringify, writeJson } from "./lib.mjs";

for (const runtime of ["typescript", "python"]) {
  const src = readJson(path.join(ARTIFACTS_DIR, "conformance", runtime, "all.json"));
  const canonical = src.results.map((r) => {
    const c = canonicalizeForParity(r);
    return { ...c, parityHash: sha256Hex(stableStringify(c)) };
  });
  writeJson(path.join(ARTIFACTS_DIR, "conformance", runtime, "canonical.json"), {
    runtime,
    results: canonical,
  });
}

console.log("canonicalized conformance artifacts");

