#!/usr/bin/env node
/**
 * Outcome Certificate v2 JSON Schema remains in-repo for legacy fixtures, but
 * `loadSchemaValidator("outcome-certificate-v2")` must not appear in production `src/**`
 * (only `src/schemaLoad.ts` may register the validator name).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const FORBIDDEN =
  /loadSchemaValidator\s*\(\s*["']outcome-certificate-v2["']\s*\)/;

function walkTsProduction(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkTsProduction(p, out);
    else if (ent.isFile() && ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

const bad = [];
for (const abs of walkTsProduction(join(root, "src"))) {
  const rel = relative(root, abs).replace(/\\/g, "/");
  if (rel === "src/schemaLoad.ts") continue;
  if (FORBIDDEN.test(readFileSync(abs, "utf8"))) bad.push(rel);
}

if (bad.length > 0) {
  console.error(
    "[check-legacy-schema-imports] Forbidden loadSchemaValidator(\"outcome-certificate-v2\") outside src/schemaLoad.ts:\n" +
      bad.map((b) => `  - ${b}`).join("\n"),
  );
  process.exit(1);
}
