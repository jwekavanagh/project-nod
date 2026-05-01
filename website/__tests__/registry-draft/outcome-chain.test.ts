import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { parseBootstrapPackInputJson, synthesizeQuickInputUtf8FromOpenAiV1 } from "agentskeptic/bootstrapPackSynthesis";
import { normalizeOpenAiToolCallsToBootstrapPackInput } from "@/lib/registry-draft/normalizeOpenAiToolCallsToBootstrapPackInput";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const cliJs = join(repoRoot, "dist", "cli.js");
const seedSql = readFileSync(join(repoRoot, "examples", "seed.sql"), "utf8");

describe("registry-draft outcome chain", () => {
  it("runs quick using NDJSON solely from synthesizeQuickInputUtf8FromOpenAiV1 after branch-B normalization", () => {
    const envelope = JSON.parse(
      readFileSync(join(repoRoot, "test", "fixtures", "registry-draft", "branch-b-envelope.json"), "utf8"),
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
        [cliJs, "quick", "--input", inPath, "--db", dbPath, "--export-registry", exportReg, "--no-human-report"],
        {
          encoding: "utf8",
          cwd: repoRoot,
          maxBuffer: 10_000_000,
        },
      );
      expect(r.status, r.stderr + r.stdout).toBe(0);
      expect(r.stdout).toContain('"stateRelation":"matches_expectations"');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
