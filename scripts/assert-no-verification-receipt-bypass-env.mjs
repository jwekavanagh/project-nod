#!/usr/bin/env node
/**
 * Ban env-based receipt bypass placeholder tokens in TS sources (merge gate hygiene).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const srcDir = join(__dirname, "..", "src");

const BANNED = ["DISABLE_RECEIPT", "SKIP_RECEIPT", "AGENTSKEPTIC_RECEIPT"];

/** @param {string} dir */
function* walkTs(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) yield* walkTs(p);
    else if (p.endsWith(".ts")) yield p;
  }
}

let failed = false;
for (const file of walkTs(srcDir)) {
  const text = readFileSync(file, "utf8");
  for (const tok of BANNED) {
    if (text.includes(tok)) {
      console.error(`[assert-no-verification-receipt-bypass-env] ${tok} in ${file}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
