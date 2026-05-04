/**
 * Batch verification against Postgres via verifyWorkflow (verifier_ro).
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { verifyWorkflow } from "../dist/pipeline.js";
import { loadSchemaValidator } from "../dist/schemaLoad.js";
import { parseExecutionTruthLayerJsonFromStderr } from "./oss-product-activation-cli-stderr.lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const eventsPath = join(root, "examples", "events.ndjson");
const registryPath = join(root, "examples", "tools.json");
const eventsMulti = join(root, "test/fixtures/multi-effect/events.ndjson");
const registryMulti = join(root, "test/fixtures/multi-effect/tools.json");
const goldenMultiOk = JSON.parse(
  readFileSync(join(root, "test/golden/wf_multi_ok.stdout.json"), "utf8"),
);
const cliJs = join(root, "dist", "cli.js");

const verifyUrl = process.env.POSTGRES_VERIFICATION_URL;

/** Bound hung CLI regressions (spawnSync defaults to waiting forever). */
const cliSpawnMs = 120_000;

describe("verifyWorkflow Postgres integration", () => {
  before(() => {
    assert.ok(verifyUrl && verifyUrl.length > 0, "POSTGRES_VERIFICATION_URL must be set");
  });

  const noopLog = () => {};
  const pgDb = () => ({ kind: "postgres", connectionString: verifyUrl });

  it("wf_complete → complete / verified", async () => {
    const r = await verifyWorkflow({
      workflowId: "wf_complete",
      eventsPath,
      registryPath,
      database: pgDb(),
      logStep: noopLog,
      truthReport: () => {},
    });
    assert.equal(r.status, "complete");
    assert.equal(r.steps[0]?.status, "verified");
    assert.equal(r.schemaVersion, 15);
    assert.deepStrictEqual(r.verificationPolicy, {
      consistencyMode: "strong",
      verificationWindowMs: 0,
      pollIntervalMs: 0,
    });
  });

  it("wf_complete eventual wiring → complete, policy echoed", async () => {
    const r = await verifyWorkflow({
      workflowId: "wf_complete",
      eventsPath,
      registryPath,
      database: pgDb(),
      logStep: noopLog,
      truthReport: () => {},
      verificationPolicy: {
        consistencyMode: "eventual",
        verificationWindowMs: 500,
        pollIntervalMs: 100,
      },
    });
    assert.equal(r.status, "complete");
    assert.equal(r.steps[0]?.status, "verified");
    assert.deepStrictEqual(r.verificationPolicy, {
      consistencyMode: "eventual",
      verificationWindowMs: 500,
      pollIntervalMs: 100,
    });
  });

  it("wf_missing → inconsistent / ROW_ABSENT", async () => {
    const r = await verifyWorkflow({
      workflowId: "wf_missing",
      eventsPath,
      registryPath,
      database: pgDb(),
      logStep: noopLog,
      truthReport: () => {},
    });
    assert.equal(r.status, "inconsistent");
    assert.equal(r.steps[0]?.status, "missing");
    assert.equal(r.steps[0]?.reasons[0]?.code, "ROW_ABSENT");
  });

  it("wf_multi_ok matches SQLite golden (multi-effect)", async () => {
    const r = await verifyWorkflow({
      workflowId: "wf_multi_ok",
      eventsPath: eventsMulti,
      registryPath: registryMulti,
      database: pgDb(),
      logStep: noopLog,
      truthReport: () => {},
    });
    assert.deepStrictEqual(r, goldenMultiOk);
    const v = loadSchemaValidator("workflow-result");
    if (!v(r)) {
      assert.fail(JSON.stringify(v.errors ?? []));
    }
  });

  it("wf_hybrid_demo: sql_row + http_witness (local server)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hybrid-pg-"));
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
    const eventsHybrid = join(dir, "events.ndjson");
    const regHybrid = join(dir, "tools.json");
    writeFileSync(
      eventsHybrid,
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
    const reg = [
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
    ];
    writeFileSync(regHybrid, JSON.stringify(reg));
    try {
      const r = await verifyWorkflow({
        workflowId: "wf_hybrid_demo",
        eventsPath: eventsHybrid,
        registryPath: regHybrid,
        database: pgDb(),
        logStep: noopLog,
        truthReport: () => {},
      });
      assert.equal(r.workflowId, "wf_hybrid_demo");
      assert.equal(r.status, "complete");
      assert.equal(r.steps.length, 2);
      assert.equal(r.steps[0].toolId, "crm.upsert_contact");
      assert.equal(r.steps[0].status, "verified");
      assert.equal(r.steps[1].toolId, "demo.hybrid_witness");
      assert.equal(r.steps[1].status, "verified");
      assert.equal(r.steps[1].reasons?.length ?? 0, 0);
    } finally {
      await new Promise((resolve) => server.close(() => resolve()));
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("nonexistent table → CONNECTOR_ERROR / incomplete", async () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-pg-"));
    const regPath = join(dir, "tools.json");
    const reg = JSON.parse(readFileSync(registryPath, "utf8"));
    reg[0].verification.table = { const: "no_such_table_xyz" };
    writeFileSync(regPath, JSON.stringify(reg));
    try {
      const r = await verifyWorkflow({
        workflowId: "wf_complete",
        eventsPath,
        registryPath: regPath,
        database: pgDb(),
        logStep: noopLog,
        truthReport: () => {},
      });
      assert.equal(r.status, "incomplete");
      assert.equal(r.steps[0]?.status, "incomplete_verification");
      assert.equal(r.steps[0]?.reasons[0]?.code, "CONNECTOR_ERROR");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CLI invalid postgres port → exit 3 and stderr JSON", () => {
    const badUrl = "postgresql://verifier_ro:verifier@127.0.0.1:65534/postgres";
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "--workflow-id",
        "wf_complete",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--postgres-url",
        badUrl,
      ],
      { encoding: "utf8", cwd: root, timeout: cliSpawnMs },
    );
    assert.ok(!r.error, r.error?.message ?? String(r.error));
    assert.equal(r.status, 3);
    assert.equal(r.stdout.trim(), "");
    const err = parseExecutionTruthLayerJsonFromStderr(r.stderr);
    assert.equal(err.kind, "execution_truth_layer_error");
    assert.equal(err.code, "POSTGRES_CLIENT_SETUP_FAILED");
    assert.ok(typeof err.message === "string");
  });

  it("CLI both --db and --postgres-url → exit 3 CLI_USAGE", () => {
    const r = spawnSync(
      process.execPath,
      [
        "--no-warnings",
        cliJs,
        "--workflow-id",
        "wf_complete",
        "--events",
        eventsPath,
        "--registry",
        registryPath,
        "--db",
        "/nope.db",
        "--postgres-url",
        verifyUrl,
      ],
      { encoding: "utf8", cwd: root, timeout: cliSpawnMs },
    );
    assert.ok(!r.error, r.error?.message ?? String(r.error));
    assert.equal(r.status, 3);
    const err = parseExecutionTruthLayerJsonFromStderr(r.stderr);
    assert.equal(err.code, "CLI_USAGE");
  });
});
