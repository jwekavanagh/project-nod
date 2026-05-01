#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(join(root, "schemas", "ci", "kernel-browser-open-patterns.json"), "utf8"),
);

const compiled = (manifest.patterns ?? []).map(
  /** @param {{ name:string, regex:string }} p */
  (p) => ({ name: p.name, regex: new RegExp(p.regex, "m") }),
);

/** @param {string} dir @param {(p:string)=>void} visitor */
function walkTs(dir, visitor) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, visitor);
    else if (st.isFile() && name.endsWith(".ts")) visitor(p);
  }
}

const hits = [];

walkTs(join(root, "src"), (absPath) => {
  const rel = relative(root, absPath);
  const base = absPath.replace(/\\/g, "/").split("/").pop() ?? "";
  if (base.endsWith(".test.ts")) return;

  let text = readFileSync(absPath, "utf8");
  /** strip block comments naive */
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  /** strip full-line comments */
  text = text.replace(/^\s*\/\/[^\n\r]*$/gm, "");

  for (const { name, regex } of compiled) {
    if (regex.test(text))
      hits.push({ pattern: name, file: rel.replace(/\\/g, "/"), sample: regex.source.slice(0, 80) });
  }
});

if (hits.length > 0) {
  console.error("[assert-no-browser-open-in-kernel] kernel browser/url launcher hits:");
  for (const h of hits) console.error(`  ${h.pattern}: ${h.file}`);
  process.exit(1);
}
console.error("assert-no-browser-open-in-kernel: ok");
