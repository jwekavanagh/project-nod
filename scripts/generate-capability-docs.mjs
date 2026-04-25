#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const capPath = path.join(root, "artifacts", "capabilities", "connector-capabilities.json");
const verifyDoc = path.join(root, "docs", "verification-state-stores.md");
const integratorDoc = path.join(root, "docs", "integrator-verification.md");
const check = process.argv.includes("--check");

const cap = JSON.parse(readFileSync(capPath, "utf8"));
const lines = [];
lines.push("## Generated Capability Matrix");
lines.push("");
lines.push("| Behavior | Capability | TS | Python |");
lines.push("| --- | --- | --- | --- |");
for (const b of [...cap.behaviors].sort((a, z) => a.supportedBehaviorId.localeCompare(z.supportedBehaviorId))) {
  lines.push(`| \`${b.supportedBehaviorId}\` | \`${b.capabilityState}\` | \`${b.runtimeStates.typescript}\` | \`${b.runtimeStates.python}\` |`);
}
const block = `${lines.join("\n")}\n`;

syncSection(verifyDoc, block, check);
syncSection(integratorDoc, block, check);
console.log(check ? "capability docs check: OK" : "capability docs generated");

function syncSection(filePath, content, checkMode) {
  const start = "<!-- GENERATED_CAPABILITY_MATRIX_START -->";
  const end = "<!-- GENERATED_CAPABILITY_MATRIX_END -->";
  const original = readFileSync(filePath, "utf8");
  if (!original.includes(start) || !original.includes(end)) {
    throw new Error(`missing generated markers in ${filePath}`);
  }
  const next = `${original.slice(0, original.indexOf(start) + start.length)}\n\n${content}\n${original.slice(original.indexOf(end))}`;
  if (checkMode) {
    if (original !== next) throw new Error(`docs drift detected: ${filePath}`);
    return;
  }
  writeFileSync(filePath, next, "utf8");
}

