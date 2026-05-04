#!/usr/bin/env node
/**
 * Hybrid contract demo: one workflow verifies SQL (Postgres) plus an HTTP witness
 * against a local ephemeral HTTP server (no third-party network).
 *
 * Requires: `npm run build` (uses dist/), Node 22+, and POSTGRES_VERIFICATION_URL
 * (same verifier_ro-capable URL as CI / docs).
 */
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const verifyUrl = process.env.POSTGRES_VERIFICATION_URL?.trim();
if (!verifyUrl) {
  console.error("POSTGRES_VERIFICATION_URL must be set to a Postgres verification URL (verifier_ro).");
  process.exit(2);
}

const distPipeline = pathToFileURL(join(root, "dist", "pipeline.js")).href;
const { verifyWorkflow } = await import(distPipeline);

const dir = mkdtempSync(join(tmpdir(), "hybrid-demo-"));
const server = createServer((req, res) => {
  if (req.url === "/witness") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => resolve());
  server.on("error", reject);
});
const port = server.address().port;
const witnessBase = `http://127.0.0.1:${port}`;
const eventsPath = join(dir, "events.ndjson");
const registryPath = join(dir, "tools.json");
writeFileSync(
  eventsPath,
  [
    JSON.stringify({
      schemaVersion: 1,
      workflowId: "wf_hybrid_demo",
      seq: 0,
      type: "tool_observed",
      toolId: "crm.upsert_contact",
      params: { recordId: "c_ok", fields: { name: "Alice", status: "active" } },
    }),
    JSON.stringify({
      schemaVersion: 1,
      workflowId: "wf_hybrid_demo",
      seq: 1,
      type: "tool_observed",
      toolId: "demo.hybrid_witness",
      params: {},
    }),
  ].join("\n") + "\n",
);
writeFileSync(
  registryPath,
  JSON.stringify([
    {
      toolId: "crm.upsert_contact",
      effectDescriptionTemplate: "Upsert contact {/recordId} with fields {/fields}",
      verification: {
        kind: "sql_row",
        table: { const: "contacts" },
        identityEq: [{ column: { const: "id" }, value: { pointer: "/recordId" } }],
        requiredFields: { pointer: "/fields" },
      },
    },
    {
      toolId: "demo.hybrid_witness",
      effectDescriptionTemplate: "HTTP witness",
      verification: {
        kind: "http_witness",
        method: "GET",
        url: { const: `${witnessBase}/witness` },
        expectedStatus: { const: 200 },
      },
    },
  ]),
);
try {
  const r = await verifyWorkflow({
    workflowId: "wf_hybrid_demo",
    eventsPath,
    registryPath,
    database: { kind: "postgres", connectionString: verifyUrl },
    logStep: () => {},
    truthReport: () => {},
  });
  console.log(JSON.stringify({ workflowId: r.workflowId, status: r.status, steps: r.steps }, null, 2));
  if (r.status !== "complete" || r.steps.length !== 2 || r.steps[1]?.status !== "verified") {
    process.exit(1);
  }
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
}
