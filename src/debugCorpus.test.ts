import { copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  DEBUG_CORPUS_CODES,
  isPathUnderRoot,
  listCorpusRunIds,
  loadAllCorpusRuns,
  loadCorpusRun,
  resolveCorpusRootReal,
} from "./debugCorpus.js";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const negativeRoot = join(root, "test", "fixtures", "corpus-negative");
const runOkDir = join(root, "examples", "debug-corpus", "run_ok");

describe("debugCorpus", () => {
  it("examples/debug-corpus has one sealed run (run_ok)", () => {
    const corpus = join(root, "examples", "debug-corpus");
    const outcomes = loadAllCorpusRuns(corpus);
    expect(outcomes).toHaveLength(1);
    const ok = outcomes.filter((o) => o.loadStatus === "ok");
    expect(ok).toHaveLength(1);
    expect(ok[0]!.runId).toBe("run_ok");
    expect(ok[0]!.agentRunRecord.workflowId).toBe("wf_complete");
  });

  it("corpus-negative fixtures produce expected error codes", () => {
    const rootReal = resolveCorpusRootReal(negativeRoot);
    const bad = loadCorpusRun(rootReal, "run_bad_json");
    expect(bad.loadStatus).toBe("error");
    if (bad.loadStatus === "error") {
      expect(bad.error.code).toBe(DEBUG_CORPUS_CODES.WORKFLOW_RESULT_JSON);
    }
    const missing = loadCorpusRun(rootReal, "run_missing_events");
    expect(missing.loadStatus).toBe("error");
    if (missing.loadStatus === "error") {
      expect(missing.error.code).toBe(DEBUG_CORPUS_CODES.MISSING_EVENTS);
    }
    const inv = loadCorpusRun(rootReal, "run_schema_invalid");
    expect(inv.loadStatus).toBe("error");
    if (inv.loadStatus === "error") {
      expect(inv.error.code).toBe(DEBUG_CORPUS_CODES.WORKFLOW_RESULT_INVALID);
    }
  });

  it("rejects bundle without agent-run.json", () => {
    const base = mkdtempSync(join(tmpdir(), "etl-corpus-"));
    try {
      mkdirSync(join(base, "x"), { recursive: true });
      writeFileSync(join(base, "x", "workflow-result.json"), "{}");
      writeFileSync(join(base, "x", "events.ndjson"), "\n");
      const rootReal = resolveCorpusRootReal(base);
      const o = loadCorpusRun(rootReal, "x");
      expect(o.loadStatus).toBe("error");
      if (o.loadStatus === "error") {
        expect(o.error.code).toBe(DEBUG_CORPUS_CODES.MISSING_AGENT_RUN_MANIFEST);
      }
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("isPathUnderRoot rejects escape", () => {
    const a = join(tmpdir(), `etl-dc-${Date.now()}`);
    mkdirSync(a, { recursive: true });
    const aReal = resolveCorpusRootReal(a);
    try {
      const outside = join(aReal, "..", "..");
      const outsideReal = resolveCorpusRootReal(outside);
      expect(isPathUnderRoot(aReal, outsideReal)).toBe(false);
    } finally {
      rmSync(a, { recursive: true, force: true });
    }
  });

  it("never omits a child directory from enumeration", () => {
    const base = mkdtempSync(join(tmpdir(), "etl-corpus-"));
    try {
      mkdirSync(join(base, "a"), { recursive: true });
      mkdirSync(join(base, "b"), { recursive: true });
      writeFileSync(join(base, "a", "workflow-result.json"), "{}");
      writeFileSync(join(base, "b", "workflow-result.json"), "{}");
      const ids = listCorpusRunIds(base);
      expect(ids.sort()).toEqual(["a", "b"]);
      const out = loadAllCorpusRuns(base);
      expect(out).toHaveLength(2);
      expect(out.every((o) => o.loadStatus === "error")).toBe(true);
      expect(
        out.every(
          (o) => o.loadStatus === "error" && o.error.code === DEBUG_CORPUS_CODES.MISSING_AGENT_RUN_MANIFEST,
        ),
      ).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("ARTIFACT_INTEGRITY_MISMATCH when manifest hash does not match disk", () => {
    const base = mkdtempSync(join(tmpdir(), "etl-corpus-tamper-"));
    try {
      const runDir = join(base, "tampered");
      mkdirSync(runDir, { recursive: true });
      for (const f of ["events.ndjson", "workflow-result.json", "agent-run.json"] as const) {
        copyFileSync(join(runOkDir, f), join(runDir, f));
      }
      const arPath = join(runDir, "agent-run.json");
      const ar = JSON.parse(readFileSync(arPath, "utf8")) as {
        artifacts: { events: { sha256: string } };
      };
      ar.artifacts.events.sha256 = `${ar.artifacts.events.sha256.slice(0, -1)}0`;
      writeFileSync(arPath, JSON.stringify(ar, null, 2));
      const rootReal = resolveCorpusRootReal(base);
      const o = loadCorpusRun(rootReal, "tampered");
      expect(o.loadStatus).toBe("error");
      if (o.loadStatus === "error") {
        expect(o.error.code).toBe(DEBUG_CORPUS_CODES.ARTIFACT_INTEGRITY_MISMATCH);
      }
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("PATH_ESCAPE when resolved path leaves corpus root", () => {
    const base = mkdtempSync(join(tmpdir(), "etl-corpus-"));
    try {
      const rootReal = resolveCorpusRootReal(base);
      const o = loadCorpusRun(rootReal, "..");
      expect(o.loadStatus).toBe("error");
      if (o.loadStatus === "error") {
        expect(o.error.code).toBe(DEBUG_CORPUS_CODES.PATH_ESCAPE);
      }
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
