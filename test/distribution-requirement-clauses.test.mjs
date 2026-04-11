/**
 * REQ-DIST clause headings: bijection on docs/distribution-product-requirement.md
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const docPath = join(root, "docs", "distribution-product-requirement.md");

function extractClauseIds(md) {
  const re = /^###\s+(REQ-DIST-\d+)\s*$/gm;
  const out = [];
  let m;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out;
}

describe("distribution-product-requirement clause headings", () => {
  it("has unique REQ-DIST headings in numeric order", () => {
    const raw = readFileSync(docPath, "utf8");
    const ids = extractClauseIds(raw);
    const set = new Set(ids);
    assert.equal(ids.length, set.size, `duplicate clause ids: ${ids.join(", ")}`);
    assert.ok(ids.length >= 1, "expected at least one REQ-DIST heading");
    const nums = ids.map((id) => Number(id.replace("REQ-DIST-", "")));
    const sorted = [...nums].sort((a, b) => a - b);
    assert.deepEqual(nums, sorted, "REQ-DIST ids should be sorted ascending in file");
  });
});
