#!/usr/bin/env node
/**
 * Ensures docs/commercial-ssot.md parity table matches config/commercial-plans.json.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "config", "commercial-plans.json");
const mdPath = path.join(root, "docs", "commercial-ssot.md");

const plans = JSON.parse(readFileSync(jsonPath, "utf8")).plans;
const md = readFileSync(mdPath, "utf8");

const required = [
  String(plans.starter.includedMonthly),
  String(plans.individual.includedMonthly),
  String(plans.team.includedMonthly),
  String(plans.business.includedMonthly),
];

for (const n of required) {
  if (!md.includes(n)) {
    console.error(`check-commercial-plans-ssot: docs/commercial-ssot.md must mention limit ${n}`);
    process.exit(1);
  }
}

console.log("check-commercial-plans-ssot: ok");

const sync = spawnSync(
  process.execPath,
  ["scripts/sync-commercial-entitlement-doc.mjs", "--check"],
  { cwd: root, stdio: "inherit" },
);
if (sync.status !== 0) process.exit(sync.status ?? 1);
