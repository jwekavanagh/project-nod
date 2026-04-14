/**
 * I0 gate: committed pointer-promotion fixture exists and matches golden path list.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("quick-param-pointer fixtures present", () => {
  it("fixture sqlite exists and paths match golden", () => {
    const golden = JSON.parse(
      readFileSync(join(root, "test/golden/quick-param-pointer/v1/fixture-paths.json"), "utf8"),
    );
    assert.ok(Array.isArray(golden));
    assert.deepEqual(golden, ["test/fixtures/quick-param-pointer/pointer-promotion.sqlite"]);
    for (const rel of golden) {
      const abs = join(root, rel);
      statSync(abs);
    }
  });
});
