import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const REQUIRED = [
  "### Low-friction integration (in-process)",
  "### Batch and CLI (replay)",
  "### Engineer note: shared step core",
  "### Operator",
  "await withWorkflowVerification",
  "observeStep",
  "Workflow verification observeStep invoked after workflow run completed",
  "MALFORMED_EVENT_LINE",
  "DUPLICATE_SEQ",
  "strings and primitives are not parsed as NDJSON",
  "example:workflow-hook",
  "One root boundary; library owns DB close in finally; avoids silent leaks when integrators omit a terminal call.",
  "Same event contract for CI and external logs without requiring in-process wrapper.",
  "One reconciliation path; batch and in-process cannot drift.",
  "redact params in retained logs",
];

describe("docs contract (SSOT + README)", () => {
  it("contains all pinned substrings", () => {
    const ssot = readFileSync(join(root, "docs", "execution-truth-layer.md"), "utf8");
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const bundle = `${ssot}\n${readme}`;
    for (const s of REQUIRED) {
      assert.ok(bundle.includes(s), `missing substring: ${s.slice(0, 60)}…`);
    }
  });
});
