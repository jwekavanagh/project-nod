/**
 * Normative Outcome Certificate + WorkflowResult engine prose in docs/agentskeptic.md (CI-delimited regions).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const etlPath = join(root, "docs", "agentskeptic.md");
const workflowResultSchemaPath = join(root, "schemas", "workflow-result.schema.json");

const OUTCOME_SEGMENT_RE =
  /<!-- ci:outcome-certificate-normative-prose:start -->([\s\S]*?)<!-- ci:outcome-certificate-normative-prose:end -->/g;

const REQUIRED_OUTCOME_PHRASES = [
  "schemas/outcome-certificate-v3.schema.json",
  "`schemaVersion` 3",
  "**`failureSpine`**",
  "**`WorkflowResult`** (`schemaVersion` **15**)",
  "evidenceCompleteness",
  "outcome-certificate-normative.md",
];

const MARKER_OUTCOME_3 = "<!-- ci:normative-outcome-certificate-schemaVersion:3 -->";

describe("docs agentskeptic normative prose (outcome certificate + engine)", () => {
  it("workflow-result.schema.json const is 15 (engine wire)", () => {
    const j = JSON.parse(readFileSync(workflowResultSchemaPath, "utf8"));
    assert.strictEqual(j.properties?.schemaVersion?.const, 15);
  });

  it("ETL doc contains outcome certificate schemaVersion:3 anchor comment", () => {
    const doc = readFileSync(etlPath, "utf8");
    assert.ok(doc.includes(MARKER_OUTCOME_3), "missing ci:normative-outcome-certificate-schemaVersion:3 marker");
  });

  it("outcome certificate normative segments contain required integrator contract phrases", () => {
    const doc = readFileSync(etlPath, "utf8");
    const segments = [];
    let m;
    OUTCOME_SEGMENT_RE.lastIndex = 0;
    while ((m = OUTCOME_SEGMENT_RE.exec(doc)) !== null) {
      segments.push(m[1]);
    }
    assert.ok(segments.length >= 1, "no outcome-certificate-normative-prose segments found");
    const combined = segments.join("\n");
    for (const phrase of REQUIRED_OUTCOME_PHRASES) {
      assert.ok(
        combined.includes(phrase),
        `required normative phrase missing: ${JSON.stringify(phrase)}`,
      );
    }
  });
});
