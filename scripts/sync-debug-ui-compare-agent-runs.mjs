/**
 * Rewrites each test/fixtures/debug-ui-compare/<runId>/agent-run.json to align with
 * on-disk events.ndjson + workflow-result.json bytes (SHA-256 + byteLength).
 * Preserves producer, verifiedAt, runId, and optional customerId/capturedAt from the prior manifest.
 *
 * Run after build: npm run build && node scripts/sync-debug-ui-compare-agent-runs.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentRunRecordForBundle } from "../dist/agentRunRecord.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const corpus = join(root, "test", "fixtures", "debug-ui-compare");

for (const name of readdirSync(corpus).sort()) {
  const dir = join(corpus, name);
  if (!statSync(dir).isDirectory()) continue;
  const arPath = join(dir, "agent-run.json");
  const evPath = join(dir, "events.ndjson");
  const wrPath = join(dir, "workflow-result.json");
  if (!existsSync(arPath) || !existsSync(evPath) || !existsSync(wrPath)) continue;

  const old = JSON.parse(readFileSync(arPath, "utf8"));
  const ev = readFileSync(evPath);
  const wr = readFileSync(wrPath);
  const wf = JSON.parse(wr.toString("utf8"));

  const record = buildAgentRunRecordForBundle({
    runId: old.runId,
    workflowId: wf.workflowId,
    producer: old.producer,
    verifiedAt: old.verifiedAt,
    workflowResultBytes: wr,
    eventsBytes: ev,
    ...(typeof old.customerId === "string" && old.customerId.length > 0 ? { customerId: old.customerId } : {}),
    ...(typeof old.capturedAt === "string" && old.capturedAt.length > 0 ? { capturedAt: old.capturedAt } : {}),
  });
  writeFileSync(arPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.error(`sync-debug-ui-compare-agent-runs: ${name}`);
}
