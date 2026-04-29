#!/usr/bin/env node
/**
 * `postTrustDecisionBlocked` must not gate on **`LICENSE_PREFLIGHT_ENABLED`** (CLI metering is orthogonal).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "commercial", "postTrustDecisionBlocked.ts");
const buf = readFileSync(root, "utf8");
if (buf.includes("LICENSE_PREFLIGHT_ENABLED")) {
  console.error("[assert-commercial-trust-ingest-rules] postTrustDecisionBlocked must not reference LICENSE_PREFLIGHT_ENABLED");
  process.exit(1);
}
console.error("assert-commercial-trust-ingest-rules: ok");
