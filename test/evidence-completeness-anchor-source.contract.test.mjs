/**
 * Anchor monopoly: literal `=== evidence_completeness ===` must appear only in
 * `src/formatEvidenceCompletenessHuman.ts` (production TypeScript).
 *
 * Allowlist rationale: duplicated literals embed the human contract twice; callers
 * must route through appendEvidenceCompletenessHuman / formatEvidenceCompletenessHuman.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const NEEDLE = "=== evidence_completeness ===";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Relative to `src/`, posix-style for stable comparison. */
const ALLOWLIST = new Set(["formatEvidenceCompletenessHuman.ts"]);

function walkTsFiles(dirAbs, out = []) {
  for (const name of readdirSync(dirAbs)) {
    if (name === "sdk" || name === "__tests__") continue;
    const p = join(dirAbs, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsFiles(p, out);
    else if (name.endsWith(".ts") && !name.includes(".test")) out.push(p);
  }
  return out;
}

describe("evidence completeness anchor monopoly (production src)", () => {
  it("no literal anchor outside formatEvidenceCompletenessHuman.ts", () => {
    const srcDir = join(root, "src");
    const offenders = [];
    for (const abs of walkTsFiles(srcDir)) {
      const rel = relative(srcDir, abs).replaceAll("\\", "/");
      const text = readFileSync(abs, "utf8");
      if (!text.includes(NEEDLE)) continue;
      if (ALLOWLIST.has(rel)) continue;
      offenders.push(rel);
    }
    assert.deepEqual(
      offenders,
      [],
      `Found ${NEEDLE} in src/**/*.ts outside allowlist ${[...ALLOWLIST].join(", ")}: ${offenders.join(", ") || "(none)"}`,
    );
  });
});
