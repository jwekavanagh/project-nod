import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, "..", "src");

function listSourceUtf8(rel) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

describe("no legacy formatDecisionBlockerForHumans", () => {
  it("grep surface: export and symbol removed from decision surface", () => {
    const index = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
    assert.ok(!index.includes("formatDecisionBlockerForHumans"));
  });

  it("implementation removed from decisionBlocker module", () => {
    assert.ok(!listSourceUtf8("decisionBlocker.ts").includes("formatDecisionBlockerForHumans"));
  });
});
