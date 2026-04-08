/**
 * Normative WorkflowResult v14 prose in docs/execution-truth-layer.md (CI-delimited regions).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const etlPath = join(root, "docs", "execution-truth-layer.md");
const workflowResultSchemaPath = join(root, "schemas", "workflow-result.schema.json");

const SEGMENT_RE = /<!-- ci:workflow-result-normative-prose:start -->([\s\S]*?)<!-- ci:workflow-result-normative-prose:end -->/g;

const FORBIDDEN_BACKTICK_13 = /schemaVersion[\s\S]{0,200}?`13`/;
const FORBIDDEN_BOLD_13 = /schemaVersion[\s\S]{0,200}?\*\*13\*\*/;

/** Must each appear at least once in the concatenated normative segments (after joining). */
const REQUIRED_PHRASES = [
  "`schemaVersion` **`14`**",
  "**`schemaVersion`** **14**",
  "outer **`schemaVersion` 14**",
  "`finalizeEmittedWorkflowResult` attaches the truth report and sets **`WorkflowResult.schemaVersion` 14**",
];

const MARKER_14 = "<!-- ci:normative-workflow-result-schemaVersion:14 -->";

describe("docs workflow-result normative prose (v14)", () => {
  it("workflow-result.schema.json const is 14", () => {
    const j = JSON.parse(readFileSync(workflowResultSchemaPath, "utf8"));
    assert.strictEqual(j.properties?.schemaVersion?.const, 14);
  });

  it("ETL doc contains schemaVersion:14 anchor comment", () => {
    const doc = readFileSync(etlPath, "utf8");
    assert.ok(doc.includes(MARKER_14), "missing ci:normative-workflow-result-schemaVersion:14 marker");
  });

  it("normative segments forbid stale WorkflowResult stdout schemaVersion 13 coupling", () => {
    const doc = readFileSync(etlPath, "utf8");
    const segments = [];
    let m;
    SEGMENT_RE.lastIndex = 0;
    while ((m = SEGMENT_RE.exec(doc)) !== null) {
      segments.push(m[1]);
    }
    assert.ok(segments.length >= 1, "no workflow-result-normative-prose segments found");
    const combined = segments.join("\n");
    for (const phrase of REQUIRED_PHRASES) {
      assert.ok(
        combined.includes(phrase),
        `required normative phrase missing: ${JSON.stringify(phrase)}`,
      );
    }
    assert.equal(FORBIDDEN_BACKTICK_13.test(combined), false, "normative region must not pair schemaVersion with `13`");
    assert.equal(FORBIDDEN_BOLD_13.test(combined), false, "normative region must not pair schemaVersion with **13**");
  });
});
