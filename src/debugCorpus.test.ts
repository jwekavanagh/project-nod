import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import {
  DEBUG_CORPUS_CODES,
  isPathUnderRoot,
  listCorpusRunIds,
  loadAllCorpusRuns,
  loadCorpusRun,
  resolveCorpusRootReal,
} from "./debugCorpus.js";
import { WORKFLOW_RESULT_RUN_LEVEL_CODES_MISMATCH_MESSAGE } from "./runLevelDriftMessages.js";
import { monorepoRootForVitest } from "./vitestMonorepoRoot.js";

const root = monorepoRootForVitest(import.meta.url);
const negativeRoot = join(root, "test", "fixtures", "corpus-negative");
const runOkDir = join(root, "examples", "debug-corpus", "run_ok");

describe("debugCorpus", () => {
  it("examples/debug-corpus ships the curated demo library (5 sealed ok runs)", () => {
    const corpus = join(root, "examples", "debug-corpus");
    const outcomes = loadAllCorpusRuns(corpus);
    const runIds = listCorpusRunIds(corpus);
    assert.equal(
      outcomes.length,
      5,
      `expected 5 runs under ${corpus}; listCorpusRunIds=[${runIds.join(", ")}] cwd=${process.cwd()}`,
    );
    const ok = outcomes.filter((o) => o.loadStatus === "ok");
    expect(ok).toHaveLength(5);
    const ids = new Set(ok.map((o) => o.runId));
    for (const id of [
      "run_ok",
      "run_value_mismatch",
      "run_row_absent",
      "run_path_nonempty",
      "run_complete_b",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    const withFailureEvidence = ok.filter(
      (o) =>
        o.workflowResult.workflowTruthReport.failureAnalysis !== null &&
        o.workflowResult.workflowTruthReport.failureAnalysis.evidence.length > 0,
    );
    expect(withFailureEvidence).toHaveLength(2);
    expect(withFailureEvidence.map((o) => o.runId).sort()).toEqual(["run_row_absent", "run_value_mismatch"]);
    const pathFindings = ok.filter(
      (o) => o.workflowResult.workflowTruthReport.executionPathFindings.length > 0,
    );
    expect(pathFindings).toHaveLength(1);
    expect(pathFindings[0]!.runId).toBe("run_path_nonempty");
    const wfComplete = ok.filter((o) => o.workflowResult.workflowId === "wf_complete");
    expect(wfComplete.length).toBeGreaterThanOrEqual(3);
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

  it("v9 workflow-result runLevel drift yields WORKFLOW_RESULT_RUN_LEVEL_CODES_MISMATCH", () => {
    const base = mkdtempSync(join(tmpdir(), "etl-corpus-rl-"));
    try {
      const runDir = join(base, "drift");
      mkdirSync(runDir, { recursive: true });
      copyFileSync(join(runOkDir, "events.ndjson"), join(runDir, "events.ndjson"));
      const wrParsed = JSON.parse(readFileSync(join(runOkDir, "workflow-result.json"), "utf8")) as Record<
        string,
        unknown
      >;
      const drifting = {
        ...wrParsed,
        schemaVersion: 9,
        runLevelCodes: ["A"],
        runLevelReasons: [{ code: "B", message: "mismatch" }],
      };
      const wrBody = JSON.stringify(drifting);
      writeFileSync(join(runDir, "workflow-result.json"), wrBody);
      const wrBuf = readFileSync(join(runDir, "workflow-result.json"));
      const ar = JSON.parse(readFileSync(join(runOkDir, "agent-run.json"), "utf8")) as {
        artifacts: { workflowResult: { sha256: string; byteLength: number } };
      };
      ar.artifacts.workflowResult.sha256 = createHash("sha256").update(wrBuf).digest("hex");
      ar.artifacts.workflowResult.byteLength = wrBuf.length;
      writeFileSync(join(runDir, "agent-run.json"), JSON.stringify(ar));
      const rootReal = resolveCorpusRootReal(base);
      const o = loadCorpusRun(rootReal, "drift");
      expect(o.loadStatus).toBe("error");
      if (o.loadStatus === "error") {
        expect(o.error.code).toBe(CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_RUN_LEVEL_CODES_MISMATCH);
        expect(o.error.message).toBe(WORKFLOW_RESULT_RUN_LEVEL_CODES_MISMATCH_MESSAGE);
      }
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
