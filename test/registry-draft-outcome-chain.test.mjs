/**
 * Branch-B → normalize → parse → synthesizeQuickInputUtf8FromOpenAiV1 → `quick` CLI (see docs/registry-draft-ssot.md).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { normalizeOpenAiToolCallsToBootstrapPackInput } from "agentskeptic/registryDraft";
import { parseBootstrapPackInputJson, synthesizeQuickInputUtf8FromOpenAiV1 } from "agentskeptic/bootstrapPackSynthesis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const seedSql = readFileSync(join(root, "examples", "seed.sql"), "utf8");

describe("registry-draft outcome chain", () => {
  it("runs quick using NDJSON solely from synthesizeQuickInputUtf8FromOpenAiV1 after branch-B normalization", () => {
    const envelope = JSON.parse(
      readFileSync(join(root, "test", "fixtures", "registry-draft", "branch-b-envelope.json"), "utf8"),
    );
    const normalized = normalizeOpenAiToolCallsToBootstrapPackInput({
      workflowId: envelope.workflowId,
      tool_calls: envelope.tool_calls,
    });
    const parsed = parseBootstrapPackInputJson(JSON.stringify(normalized));
    const ndjson = synthesizeQuickInputUtf8FromOpenAiV1(parsed);

    const tmp = mkdtempSync(join(tmpdir(), "registry-draft-outcome-"));
    const dbPath = join(tmp, "chain.db");
    const inPath = join(tmp, "quick-in.ndjson");
    const exportReg = join(tmp, "quick-export.json");
    try {
      const db = new DatabaseSync(dbPath);
      db.exec(seedSql);
      db.close();
      writeFileSync(inPath, ndjson, "utf8");

      const r = spawnSync(
        process.execPath,
        [cliJs, "quick", "--input", inPath, "--db", dbPath, "--export-registry", exportReg, "--no-truth-report"],
        {
          encoding: "utf8",
          cwd: root,
          maxBuffer: 10_000_000,
        },
      );
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.ok(r.stdout.includes('"verdict":"pass"') || r.stdout.includes('"verdict": "pass"'), r.stdout);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
