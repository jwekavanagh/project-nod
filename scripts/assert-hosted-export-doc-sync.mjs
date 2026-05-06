#!/usr/bin/env node
/**
 * Hosted export doc sync — forbids stale GovernanceAuditBundleV2 / DecisionEvidenceExport / hosted_not_recorded
 * prose in synced discovery anchors; requires GovernanceAuditBundleV3 mention.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const FILES = [
  join(root, "docs", "governance.md"),
  join(root, "docs", "decision-evidence-bundle.md"),
  join(root, "docs", "integrate.md"),
  join(root, "llms.txt"),
];

const FORBIDDEN = [/GovernanceAuditBundleV2/g, /hosted_not_recorded/g, /DecisionEvidenceExport/g];
const REQUIRED = /GovernanceAuditBundleV3/;

function main() {
  for (const p of FILES) {
    let text;
    try {
      text = readFileSync(p, "utf8");
    } catch (e) {
      console.error(`[hosted-export-doc-sync] missing or unreadable: ${p}`, e);
      process.exit(1);
    }
    for (const re of FORBIDDEN) {
      if (re.test(text)) {
        console.error(`[hosted-export-doc-sync] forbidden substring in ${p}: ${String(re)}`);
        process.exit(2);
      }
    }
    if (!REQUIRED.test(text)) {
      console.error(`[hosted-export-doc-sync] missing GovernanceAuditBundleV3 in ${p}`);
      process.exit(2);
    }
  }
  console.log("hosted-evidence-doc-sync-ok");
}

main();
