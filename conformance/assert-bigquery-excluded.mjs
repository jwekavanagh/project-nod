#!/usr/bin/env node
import path from "node:path";
import { ARTIFACTS_DIR, readJson } from "./lib.mjs";

const cap = readJson(path.join(ARTIFACTS_DIR, "capabilities", "connector-capabilities.json"));
const bad = cap.behaviors.filter((b) => b.supportedBehaviorId.startsWith("bigquery.") && b.capabilityState !== "unsupported");
if (bad.length > 0) {
  throw new Error(`BigQuery must be excluded from supported scope: ${bad.map((b) => b.supportedBehaviorId).join(", ")}`);
}
console.log("bigquery excluded: OK");

