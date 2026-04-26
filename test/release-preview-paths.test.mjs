/**
 * release/preview-enforcement.paths.json must match the frozen allowlist (plan v1).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const FROZEN_PREFIXES = [
  ".github/workflows/",
  "config/",
  "conformance/",
  "examples/",
  "internal-packages/",
  "package-lock.json",
  "package.json",
  "patches/",
  "python/",
  "release/",
  "schemas/",
  "scripts/",
  "src/",
  "test/",
  "website/",
];

describe("release/preview-enforcement.paths.json", () => {
  it("matches frozen v1 schema and ordering", () => {
    const raw = JSON.parse(readFileSync(join(root, "release", "preview-enforcement.paths.json"), "utf8"));
    assert.equal(raw.version, 1);
    assert.equal(raw.prefixes.length, 15);
    assert.deepEqual(raw.prefixes, FROZEN_PREFIXES);
    const sorted = [...raw.prefixes].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(raw.prefixes, sorted);
    const uniq = new Set(raw.prefixes);
    assert.equal(uniq.size, 15);
  });
});
