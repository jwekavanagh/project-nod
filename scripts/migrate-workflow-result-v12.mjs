/**
 * Upgrade saved WorkflowResult JSON from schemaVersion 11 → 12 (bump only; wire shape unchanged).
 *
 * Scans JSON under test/golden, test/fixtures, examples (excluding examples/debug-corpus and corpus-negative).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOTS = [join(root, "test", "golden"), join(root, "test", "fixtures"), join(root, "examples")];

function shouldMigrateFile(fp) {
  const rel = fp.replace(/\\/g, "/");
  if (rel.includes("/corpus-negative/")) return false;
  if (rel.includes("/examples/debug-corpus/")) return false;
  return true;
}

function walkJsonFiles(dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkJsonFiles(p, out);
    else if (st.isFile() && name.endsWith(".json")) out.push(p);
  }
}

function needsBump(j) {
  return j && typeof j === "object" && j.schemaVersion === 11 && Array.isArray(j.steps);
}

const files = [];
for (const r of ROOTS) walkJsonFiles(r, files);

let migrated = 0;
for (const fp of files) {
  if (!shouldMigrateFile(fp)) continue;
  let raw;
  try {
    raw = readFileSync(fp, "utf8");
  } catch {
    continue;
  }
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    continue;
  }
  if (!needsBump(j)) continue;
  j.schemaVersion = 12;
  const out = `${JSON.stringify(j)}${raw.endsWith("\n") ? "\n" : ""}`;
  writeFileSync(fp, out);
  console.log("migrated", fp);
  migrated += 1;
}

if (migrated === 0) {
  console.log("migrate-workflow-result-v12: no schemaVersion 11 workflow-result-shaped files found");
}
