/**
 * Hard cutover: v2 response schema filename must not reappear under schemas/.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const forbidden = join(root, "schemas", "registry-draft-response-v2.schema.json");

describe("registry-draft response contract (no v2 filename)", () => {
  it("does not ship registry-draft-response-v2.schema.json", () => {
    assert.equal(existsSync(forbidden), false, "registry-draft-response-v2.schema.json must remain deleted");
  });
});
