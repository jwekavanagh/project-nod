#!/usr/bin/env node
/**
 * Writes website/src/content/embeddedReports/langgraph-guide.v1.json (+ lock) from wf_missing demo.
 * Requires: npm run build, Node >= 22.13, repo cwd = root.
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
process.chdir(root);

const seedPath = join(root, "examples", "seed.sql");
const eventsPath = join(root, "examples", "events.ndjson");
const registryPath = join(root, "examples", "tools.json");
const dbPath = join(root, "examples", "demo.db");

const seedSql = readFileSync(seedPath, "utf8");
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
}
const db = new DatabaseSync(dbPath);
db.exec(seedSql);
db.close();

const distPipeline = pathToFileURL(join(root, "dist", "pipeline.js")).href;
const distTruth = pathToFileURL(join(root, "dist", "workflowTruthReport.js")).href;
const { verifyWorkflow } = await import(distPipeline);
const { formatWorkflowTruthReportStruct } = await import(distTruth);

const wf = await verifyWorkflow({
  workflowId: "wf_missing",
  eventsPath,
  registryPath,
  database: { kind: "sqlite", path: dbPath },
  logStep: () => {},
  truthReport: () => {},
});

const truthReportText = formatWorkflowTruthReportStruct(wf.workflowTruthReport);
const workflowResult = JSON.parse(JSON.stringify(wf));
const envelope = {
  schemaVersion: 1,
  kind: "workflow",
  workflowResult,
  truthReportText,
};

const step0 = wf.steps[0];
const code0 = step0?.reasons[0]?.code;
if (wf.status !== "inconsistent" || step0?.status !== "missing" || code0 !== "ROW_ABSENT") {
  console.error("Fixture invariant failed:", { status: wf.status, stepStatus: step0?.status, code0 });
  process.exit(1);
}

const outDir = join(root, "website", "src", "content", "embeddedReports");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "langgraph-guide.v1.json"), JSON.stringify(envelope, null, 2) + "\n", "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
writeFileSync(
  join(outDir, "langgraph-guide.v1.lock.json"),
  JSON.stringify({ workflowVerifierVersion: pkg.version }, null, 2) + "\n",
  "utf8",
);
console.log("Wrote langgraph-guide.v1.json and langgraph-guide.v1.lock.json");
