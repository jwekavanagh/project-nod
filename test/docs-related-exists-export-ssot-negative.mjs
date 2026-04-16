/**
 * SSOT doc invariants for related_exists quick export (forbidden stale phrases + required substrings).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** Assembled so this file does not contain the stale limitation literal as a contiguous substring (repo walk). */
const STALE_LIMITATION_LITERAL = "contract_replay_export_row" + "_tools_only";

const FORBIDDEN_SUBSTRINGS = [
  STALE_LIMITATION_LITERAL,
  "related_exists units remain **inferred-only**",
];

function walkFiles(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".git" ||
      name === "dist" ||
      name === ".cursor" ||
      name === "test-results" ||
      name === ".next"
    )
      continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else if (st.isFile() && /\.(md|ts|tsx|mjs|js|json|yaml|yml)$/.test(name)) acc.push(p);
  }
}

describe("related_exists export SSOT docs + no stale limitation literal", () => {
  it("verification-product-ssot and quick-verify-normative contain required phrases and no forbidden substrings", () => {
    const product = readFileSync(join(root, "docs", "verification-product-ssot.md"), "utf8");
    const quick = readFileSync(join(root, "docs", "quick-verify-normative.md"), "utf8");
    for (const s of FORBIDDEN_SUBSTRINGS) {
      assert.equal(product.includes(s), false, `verification-product-ssot.md must not contain: ${s}`);
      assert.equal(quick.includes(s), false, `quick-verify-normative.md must not contain: ${s}`);
    }
    assert.ok(
      quick.includes("eligible_export_related_exists"),
      "quick-verify-normative must name eligible_export_related_exists",
    );
    assert.ok(quick.includes('"params": {}'), 'quick normative must document synthetic relational "params": {}');
  });

  it("repo sources contain no stale row-only export limitation literal", () => {
    const acc = [];
    walkFiles(root, acc);
    for (const p of acc) {
      const rel = p.slice(root.length + 1);
      const text = readFileSync(p, "utf8");
      assert.equal(
        text.includes(STALE_LIMITATION_LITERAL),
        false,
        `stale literal in ${rel}`,
      );
    }
  });
});
