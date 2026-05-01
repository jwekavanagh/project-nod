import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const forbidden = join(repoRoot, "schemas", "registry-draft-response-v2.schema.json");

describe("registry-draft response contract (no v2 filename)", () => {
  it("does not ship registry-draft-response-v2.schema.json", () => {
    expect(existsSync(forbidden)).toBe(false);
  });
});
