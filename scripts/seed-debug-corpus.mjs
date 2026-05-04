#!/usr/bin/env node
/**
 * Regenerates sealed bundles under examples/debug-corpus/ (including canonical JSON for run_ok).
 * Run after build: npm run build && node scripts/seed-debug-corpus.mjs
 */
import { readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeAgentRunBundle } from "../dist/agentRunBundle.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const corpus = join(root, "examples", "debug-corpus");
const producer = { name: "agentskeptic", version: "1.2.2" };
const verifiedAt = "2026-04-23T12:00:00.000Z";

function eventsLineBytes(workflowId) {
  const raw = readFileSync(join(root, "examples", "events.ndjson"), "utf8");
  const lines = raw.split(/\n/).filter((l) => l.length > 0);
  const line = lines.find((l) => {
    try {
      return JSON.parse(l).workflowId === workflowId;
    } catch {
      return false;
    }
  });
  if (!line) throw new Error(`No events.ndjson line for workflowId=${workflowId}`);
  return Buffer.from(`${line}\n`, "utf8");
}

const wfInconsistent = JSON.parse(
  readFileSync(join(root, "test", "fixtures", "wf_inconsistent_result.json"), "utf8"),
);
const outVm = join(corpus, "run_value_mismatch");
rmSync(outVm, { recursive: true, force: true });
writeAgentRunBundle({
  outDir: outVm,
  eventsNdjson: eventsLineBytes("wf_inconsistent"),
  workflowResult: wfInconsistent,
  producer,
  verifiedAt,
});

const embedded = JSON.parse(
  readFileSync(
    join(root, "website", "src", "content", "embeddedReports", "langgraph-guide.v1.json"),
    "utf8",
  ),
);
const wfMissing = embedded.workflowResult;
const outRa = join(corpus, "run_row_absent");
rmSync(outRa, { recursive: true, force: true });
writeAgentRunBundle({
  outDir: outRa,
  eventsNdjson: eventsLineBytes("wf_missing"),
  workflowResult: wfMissing,
  producer,
  verifiedAt,
});

const wfOk = JSON.parse(readFileSync(join(corpus, "run_ok", "workflow-result.json"), "utf8"));
const evOk = readFileSync(join(corpus, "run_ok", "events.ndjson"));
const outB = join(corpus, "run_complete_b");
rmSync(outB, { recursive: true, force: true });
writeAgentRunBundle({
  outDir: outB,
  eventsNdjson: evOk,
  workflowResult: wfOk,
  producer,
  verifiedAt,
});

const pathNonemptySrc = join(root, "test", "fixtures", "debug-ui-compare", "run_path_nonempty");
const pathNonemptyWf = JSON.parse(readFileSync(join(pathNonemptySrc, "workflow-result.json"), "utf8"));
const pathNonemptyEv = readFileSync(join(pathNonemptySrc, "events.ndjson"));
const dstPath = join(corpus, "run_path_nonempty");
rmSync(dstPath, { recursive: true, force: true });
writeAgentRunBundle({
  outDir: dstPath,
  eventsNdjson: pathNonemptyEv,
  workflowResult: pathNonemptyWf,
  producer,
  verifiedAt,
});

const runOkDir = join(corpus, "run_ok");
const wfOkCanonical = JSON.parse(readFileSync(join(runOkDir, "workflow-result.json"), "utf8"));
const evOkCanonical = readFileSync(join(runOkDir, "events.ndjson"));
rmSync(runOkDir, { recursive: true, force: true });
writeAgentRunBundle({
  outDir: runOkDir,
  eventsNdjson: evOkCanonical,
  workflowResult: wfOkCanonical,
  producer,
  verifiedAt,
});

console.error(
  "seed-debug-corpus: wrote run_value_mismatch, run_row_absent, run_complete_b, run_path_nonempty, run_ok",
);
