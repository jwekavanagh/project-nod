/**
 * SSOT traceability Clause ID set equals REQ-DIST heading set in product requirement doc.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const reqPath = join(root, "docs", "distribution-product-requirement.md");
const ssotPath = join(root, "docs", "public-distribution-ssot.md");

function extractReqIds(md) {
  const re = /^###\s+(REQ-DIST-\d+)\s*$/gm;
  const out = [];
  let m;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out;
}

function extractSsotClauseIds(md) {
  const start = "<!-- distribution-traceability-table:start -->";
  const end = "<!-- distribution-traceability-table:end -->";
  const i = md.indexOf(start);
  const j = md.indexOf(end);
  assert.ok(i !== -1 && j > i, "missing traceability table anchors");
  const section = md.slice(i, j);
  const re = /^\|\s*(REQ-DIST-\d+)\s*\|/gm;
  const out = [];
  let m;
  while ((m = re.exec(section)) !== null) out.push(m[1]);
  return out;
}

describe("SSOT clause coverage vs requirement doc", () => {
  it("Clause ID column matches requirement headings exactly", () => {
    const req = readFileSync(reqPath, "utf8");
    const ssot = readFileSync(ssotPath, "utf8");
    const a = extractReqIds(req).sort();
    const b = extractSsotClauseIds(ssot).sort();
    assert.deepEqual(b, a, `SSOT table clause set ${b.join(",")} !== requirement set ${a.join(",")}`);
  });
});
