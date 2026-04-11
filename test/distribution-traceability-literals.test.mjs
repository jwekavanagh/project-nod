/**
 * REQ-DIST-004 / REQ-DIST-005 Implementation cells in SSOT must contain four stable literals.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ssotPath = join(root, "docs", "public-distribution-ssot.md");

const LITERALS = ["run-name", "distribution-proof", "proof.json", "foreign_smoke_fixture_sha256"];

function extractTraceabilitySection(md) {
  const start = "<!-- distribution-traceability-literals:start -->";
  const end = "<!-- distribution-traceability-literals:end -->";
  const i = md.indexOf(start);
  const j = md.indexOf(end);
  assert.ok(i !== -1, "missing start anchor");
  assert.ok(j !== -1 && j > i, "missing end anchor");
  return md.slice(i + start.length, j);
}

function implementationCellForClause(section, clauseId) {
  const lines = section.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("|") && line.includes(clauseId)) {
      const cells = line.split("|").map((c) => c.trim());
      // | Clause | Summary | Implementation | Evidence | -> implementation index 3
      if (cells.length >= 5 && cells[1] === clauseId) return cells[3] ?? "";
    }
  }
  return null;
}

describe("public-distribution-ssot traceability literals", () => {
  it("REQ-DIST-004 and REQ-DIST-005 Implementation cells include all four proof literals", () => {
    const md = readFileSync(ssotPath, "utf8");
    const section = extractTraceabilitySection(md);
    for (const clause of ["REQ-DIST-004", "REQ-DIST-005"]) {
      const impl = implementationCellForClause(section, clause);
      assert.ok(impl, `missing table row for ${clause}`);
      for (const lit of LITERALS) {
        assert.ok(
          impl.includes(lit),
          `${clause} Implementation cell must include substring ${JSON.stringify(lit)}`,
        );
      }
    }
  });
});
