import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { loadCorpusRun, resolveCorpusRootReal } from "./debugCorpus.js";
import { withWorkflowVerification } from "./pipeline.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");

describe("withWorkflowVerification persistBundle", () => {
  let workDir: string;
  let dbPath: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "etl-wfv-persist-"));
    dbPath = join(workDir, "demo.db");
    const sql = readFileSync(join(root, "examples", "seed.sql"), "utf8");
    const db = new DatabaseSync(dbPath);
    db.exec(sql);
    db.close();
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("writes a bundle that loadCorpusRun loads as ok with one verified step", async () => {
    const eventsPath = join(root, "examples", "events.ndjson");
    const registryPath = join(root, "examples", "tools.json");
    const wfId = "wf_complete";
    const lines = readFileSync(eventsPath, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
    const events = lines.map((l) => JSON.parse(l) as { workflowId?: string }).filter((e) => e.workflowId === wfId);

    const bundleParent = mkdtempSync(join(tmpdir(), "etl-persist-out-"));
    const runId = "hook_run";
    const outDir = join(bundleParent, runId);
    try {
      const result = await withWorkflowVerification(
        {
          workflowId: wfId,
          registryPath,
          dbPath,
          truthReport: () => {},
          persistBundle: { outDir },
        },
        (observeStep) => {
          for (const ev of events) {
            observeStep(ev);
          }
        },
      );
      expect(result.steps.length).toBe(1);
      expect(result.steps[0]!.status).toBe("verified");

      const loaded = loadCorpusRun(resolveCorpusRootReal(bundleParent), runId);
      expect(loaded.loadStatus).toBe("ok");

      const written = readFileSync(join(outDir, "events.ndjson"), "utf8").trim().split(/\r?\n/);
      expect(written.length).toBe(1);
      expect(JSON.parse(written[0]!)).toEqual(events[0]);
    } finally {
      rmSync(bundleParent, { recursive: true, force: true });
    }
  });
});
