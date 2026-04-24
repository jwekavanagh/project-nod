/**
 * Fails CI if any file under docs/ ending in .md contains a verbatim SSOT checklist line
 * (prevents drift vs agentskeptic/dist/firstFiveMinutesChecklist.js).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getChecklistDocFingerprints } from "../dist/firstFiveMinutesChecklist.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function walkMdFiles(dir, acc) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkMdFiles(p, acc);
    else if (ent.isFile() && ent.name.endsWith(".md")) acc.push(p);
  }
}

describe("docs first-five-minutes SSOT guard", () => {
  it("no markdown file under docs/ contains a full SSOT checklist line", () => {
    const docsRoot = join(root, "docs");
    const mdFiles = [];
    walkMdFiles(docsRoot, mdFiles);
    const fps = getChecklistDocFingerprints();
    for (const file of mdFiles) {
      const text = readFileSync(file, "utf8");
      for (const fp of fps) {
        assert.ok(
          !text.includes(fp),
          `Forbidden SSOT checklist line found in ${file} (length ${fp.length})`,
        );
      }
    }
  });
});
