#!/usr/bin/env node
/**
 * Fail if the Python package sources import subprocess (kernel must stay in-process).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const base = path.join(root, "python", "src", "agentskeptic");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".py")) out.push(p);
  }
  return out;
}

let bad = false;
for (const p of walk(base)) {
  const txt = readFileSync(p, "utf8");
  if (/\bsubprocess\b/.test(txt)) {
    console.error(`Forbidden subprocess reference in ${path.relative(root, p)}`);
    bad = true;
  }
}
if (bad) process.exit(1);
console.log("check-python-no-subprocess: ok");
