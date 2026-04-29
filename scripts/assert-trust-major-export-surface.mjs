#!/usr/bin/env node
/** Semver-major: legacy irreversible **`Decision*` / `LangGraph*Unsafe`** symbols must stay off the public **`src/index.ts` barrel.** */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const idx = join(process.cwd(), "src", "index.ts");
const buf = readFileSync(idx, "utf8");
if (/\bDecisionUnsafeError\b/.test(buf) || /\bLangGraphCheckpointTrustUnsafeError\b/.test(buf)) {
  console.error("[assert-trust-major-export-surface] legacy Decision* error exports leaked into src/index.ts");
  process.exit(1);
}
if (!/\bTrustDecisionBlockedError\b/.test(buf)) {
  console.error("[assert-trust-major-export-surface] TrustDecisionBlockedError missing from src/index.ts");
  process.exit(1);
}
console.error("assert-trust-major-export-surface: ok");
