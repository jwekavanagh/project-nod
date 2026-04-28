/**
 * docs/golden-path.md is executable and Postgres-first.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("golden-path executable doc", () => {
  it("contains runnable steps and canonical stack language", () => {
    const s = readFileSync(join(root, "docs", "golden-path.md"), "utf8");
    assert.equal(/```bash/.test(s), true);
    assert.equal(s.includes("Next.js + Postgres"), true);
    assert.equal(s.includes("npm run golden:path"), true);
    assert.equal(s.includes("examples/golden-next-postgres"), true);
  });
});
