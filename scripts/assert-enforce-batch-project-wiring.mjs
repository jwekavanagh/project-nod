#!/usr/bin/env node
/**
 * Merge-gate: batch enforce path applies prepareBatchVerifyArgvForProjectDefaults before parseBatchVerifyCliArgs,
 * never parseBatchVerifyCliArgs(stripped).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const p = join(root, "src", "enforceStateful.ts");
const txt = readFileSync(p, "utf8");

if (txt.includes("parseBatchVerifyCliArgs(stripped)")) {
  console.error(
    "[assert-enforce-batch-project-wiring] forbid parseBatchVerifyCliArgs(stripped) — inject prepareBatchVerifyArgvForProjectDefaults first",
  );
  process.exit(1);
}

if (!txt.includes("parseBatchVerifyCliArgs(prepareBatchVerifyArgvForProjectDefaults(stripped))")) {
  console.error("[assert-enforce-batch-project-wiring] missing prepareBatchVerifyArgvForProjectDefaults batch inject");
  process.exit(1);
}

const iq = txt.indexOf("if (isQuick)");
const el = txt.indexOf("} else {");
const isQuickSlice = iq >= 0 && el >= 0 ? txt.slice(iq, el) : "";
if (isQuickSlice && isQuickSlice.includes("prepareBatchVerifyArgvForProjectDefaults")) {
  console.error("[assert-enforce-batch-project-wiring] quick path must not reference prepareBatchVerifyArgvForProjectDefaults");
  process.exit(1);
}

console.error("[assert-enforce-batch-project-wiring] ok");
