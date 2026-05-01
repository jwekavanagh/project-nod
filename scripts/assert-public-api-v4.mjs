#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dts = join(process.cwd(), "dist", "index.d.ts");
if (!existsSync(dts)) {
  console.error("[assert-public-api-v4] dist/index.d.ts missing; run npm run build");
  process.exit(1);
}
const t = readFileSync(dts, "utf8");

const offenders = [];
const exportFn = /\bexport\s+declare\s+function\s+(\w+)/g;
let m;
while ((m = exportFn.exec(t)) !== null) {
  const name = m[1];
  if (
    name === "verifyWorkflow" ||
    name === "createDecisionGate" ||
    name === "verifyAgentskeptic" ||
    name === "runQuickVerify" ||
    name === "runQuickVerifyToValidatedReport"
  ) {
    offenders.push(name);
  }
}
if (offenders.length > 0) {
  console.error("[assert-public-api-v4] forbidden root export functions:", offenders.join(", "));
  process.exit(1);
}
console.error("assert-public-api-v4: ok");
