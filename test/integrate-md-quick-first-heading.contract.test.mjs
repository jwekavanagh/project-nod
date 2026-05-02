import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const QUICK_FIRST = "## Zero-ceremony first pass (quick)";
const TRUTH_PRIMARY = "## Truth check (primary)";

describe("integrate.md onboarding ladder", () => {
  it("quick-first H2 appears before truth-check primary heading", () => {
    const doc = readFileSync(join(root, "docs", "integrate.md"), "utf8");
    const iQuick = doc.indexOf(QUICK_FIRST);
    const iTruth = doc.indexOf(TRUTH_PRIMARY);
    assert.ok(iQuick >= 0, `missing heading ${JSON.stringify(QUICK_FIRST)}`);
    assert.ok(iTruth >= 0, `missing heading ${JSON.stringify(TRUTH_PRIMARY)}`);
    assert.ok(iQuick < iTruth, "quick-first heading must precede Truth check (primary)");
  });
});
