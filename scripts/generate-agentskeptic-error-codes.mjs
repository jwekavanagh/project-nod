#!/usr/bin/env node
/**
 * Build schemas/agentskeptic-error-codes.json from src/cliOperationalCodes.ts + extra known codes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ts = readFileSync(join(root, "src", "cliOperationalCodes.ts"), "utf8");
const keys = [...ts.matchAll(/^\s+([A-Z_0-9]+):/gm)]
  .map((m) => m[1])
  .filter((k) => k !== "as" && k !== "const");
const unique = [...new Set(keys)];

const extra = [
  "PROJECT_VERIFICATION_LAYOUT_MISSING",
  "MALFORMED_EVENT_LINE",
  "NO_STEPS_FOR_WORKFLOW",
  "LANGGRAPH_CHECKPOINT_TRUST_NON_V3_TOOL_OBSERVED",
  "CAPTURE_ORDER_NOT_MONOTONIC_IN_SEQ",
  "RESERVE_QUOTA_EXCEEDED",
  "RESERVE_INVALID_KEY",
  "RESERVE_SERVER_ERROR",
  "PROBLEM_DETAILS",
  "HTTP_CLIENT_ERROR",
];

const all = [...new Set([...unique, ...extra])].sort();

const defaultRemed = "See docs/migrate-2.md (v4 API) and docs/integrate.md.";

const entries = all.map((code) => {
  const isLicense =
    code.startsWith("LICENSE_") ||
    code.includes("SUBSCRIPTION") ||
    code.includes("ENFORCEMENT_REQUIRES");
  return {
    code,
    category: isLicense
      ? "license"
      : code.startsWith("REGISTRY_") || code.startsWith("EVENTS_")
        ? "config"
        : "operational",
    httpStatus: null,
    retryable:
      code === "LICENSE_USAGE_UNAVAILABLE" ||
      code === "SHARE_REPORT_FAILED" ||
      code === "RESERVE_SERVER_ERROR",
    remediation: defaultRemed,
  };
});

const out = { version: 1, generated: "from cliOperationalCodes + extras", entries };
const json = JSON.stringify(out, null, 2) + "\n";
const schemaPath = join(root, "schemas", "agentskeptic-error-codes.json");
writeFileSync(schemaPath, json, "utf8");
const pyData = join(root, "python", "src", "agentskeptic", "agentskeptic_error_codes.json");
writeFileSync(pyData, json, "utf8");
console.log(`Wrote ${entries.length} error code entries to schemas/agentskeptic-error-codes.json and ${pyData}`);
