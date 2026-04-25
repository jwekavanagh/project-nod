#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(readFileSync(path.join(root, "test", "support-evidence-policy.json"), "utf8"));
for (const p of policy.supportEvidenceSources) {
  if (p.startsWith("test/")) {
    throw new Error(`support evidence source must not come from test registry path: ${p}`);
  }
}
console.log("support-evidence source policy: OK");

