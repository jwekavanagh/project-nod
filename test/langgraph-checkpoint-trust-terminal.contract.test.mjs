/**
 * Terminal rows A1–D and production gate (plan: LangGraph checkpoint trust).
 */
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const embedDir = join(root, "website", "src", "content", "embeddedReports");
const ssot = {
  a2: join(embedDir, "langgraph-lct-a2-ineligible.v1.json"),
  b: join(embedDir, "langgraph-lct-b-verified.v1.json"),
  c: join(embedDir, "langgraph-lct-c-mismatch.v1.json"),
  d: join(embedDir, "langgraph-lct-d-incomplete.v1.json"),
};
const cli = join(root, "dist", "cli.js");
const partnerDir = join(root, "examples", "partner-quickstart");
const partnerRegistry = join(partnerDir, "partner.tools.json");
const partnerSeed = readFileSync(join(partnerDir, "partner.seed.sql"), "utf8");

const STABLE_RUN_B = "00000000-0000-4000-8000-00000000b0b0";
const STABLE_RUN_C = "00000000-0000-4000-8000-00000000c0c0";
const STABLE_RUN_D = "00000000-0000-4000-8000-00000000d0d0";

/** @param {{ toolId?: string; runEventId?: string; params?: Record<string, unknown>; langgraphCheckpoint?: Record<string, string> }} [opts] */
function toolLineV3(opts) {
  const o = opts ?? {};
  const line = {
    schemaVersion: 3,
    workflowId: "wf_partner",
    runEventId: o.runEventId ?? randomUUID(),
    type: "tool_observed",
    seq: 0,
    toolId: o.toolId ?? "crm.upsert_contact",
    params: o.params ?? { recordId: "partner_1", fields: { name: "You", status: "active" } },
    langgraphCheckpoint: o.langgraphCheckpoint ?? {
      threadId: "t-contract",
      checkpointNs: "",
      checkpointId: "cp-contract",
    },
  };
  return `${JSON.stringify(line)}\n`;
}

function seedDb() {
  const dir = mkdtempSync(join(tmpdir(), "lgct-"));
  const dbPath = join(dir, "p.db");
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(partnerSeed);
  } finally {
    db.close();
  }
  return { dir, dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** @param {string[]} args */
function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      // Hard isolation from other suites that inject loadEvents faults.
      AGENTSKEPTIC_TEST_THROW_ON_LOAD_EVENTS: "0",
      // Keep this contract deterministic even when running against a commercial dist build.
      AGENTSKEPTIC_API_KEY: process.env.AGENTSKEPTIC_API_KEY ?? "test_langgraph_checkpoint_key",
    },
  });
}

describe("langgraph checkpoint trust terminal contract", () => {
  it("requires dist build", () => {
    assert.ok(existsSync(cli));
  });

  it("A1: generic verify without flag exits 3 with empty stdout when v3 tool_observed present", () => {
    const { dir, dbPath, cleanup } = seedDb();
    try {
      const ev = join(dir, "e.ndjson");
      writeFileSync(ev, toolLineV3(), "utf8");
      const r = run(["--workflow-id", "wf_partner", "--events", ev, "--registry", partnerRegistry, "--db", dbPath]);
      assert.equal(r.status, 3);
      assert.equal((r.stdout ?? "").trim(), "");
      assert.ok(
        (r.stderr ?? "").includes("LANGGRAPH_CHECKPOINT_TRUST_GENERIC_MODE_CONFLICT"),
        `stderr: ${r.stderr}`,
      );
    } finally {
      cleanup();
    }
  });

  it("A2 malformed: langgraph mode exits 2 with ineligible certificate on stderr headline", () => {
    const { dir, dbPath, cleanup } = seedDb();
    try {
      const ev = join(dir, "bad.ndjson");
      writeFileSync(ev, "{not-json\n", "utf8");
      const r = run([
        "--workflow-id",
        "wf_partner",
        "--events",
        ev,
        "--registry",
        partnerRegistry,
        "--db",
        dbPath,
        "--langgraph-checkpoint-trust",
      ]);
      assert.equal(r.status, 2);
      const obj = JSON.parse((r.stdout ?? "").trim());
      assert.equal(obj.runKind, "contract_sql_langgraph_checkpoint_trust");
      assert.deepEqual(obj.steps, []);
      assert.equal(obj.checkpointVerdicts, undefined);
      assert.equal(obj.stateRelation, "not_established");
      assert.ok((r.stderr ?? "").includes("LangGraph checkpoint trust: ineligible"), r.stderr);
      const want = JSON.parse(readFileSync(ssot.a2, "utf8"));
      assert.deepStrictEqual(obj, want);
    } finally {
      cleanup();
    }
  });

  it("A2 non-v3 mix: exits 2 ineligible", () => {
    const { dir, dbPath, cleanup } = seedDb();
    try {
      const ev = join(dir, "mix.ndjson");
      writeFileSync(
        ev,
        '{"schemaVersion":1,"workflowId":"wf_partner","seq":0,"type":"tool_observed","toolId":"crm.upsert_contact","params":{"recordId":"partner_1","fields":{"name":"You","status":"active"}}}\n',
        "utf8",
      );
      const r = run([
        "--workflow-id",
        "wf_partner",
        "--events",
        ev,
        "--registry",
        partnerRegistry,
        "--db",
        dbPath,
        "--langgraph-checkpoint-trust",
      ]);
      assert.equal(r.status, 2);
      const obj = JSON.parse((r.stdout ?? "").trim());
      assert.equal(obj.steps.length, 0);
      assert.equal(obj.checkpointVerdicts, undefined);
    } finally {
      cleanup();
    }
  });

  it("A2 empty tools: exits 2 ineligible", () => {
    const { dir, dbPath, cleanup } = seedDb();
    try {
      const ev = join(dir, "empty.ndjson");
      writeFileSync(ev, "\n", "utf8");
      const r = run([
        "--workflow-id",
        "wf_partner",
        "--events",
        ev,
        "--registry",
        partnerRegistry,
        "--db",
        dbPath,
        "--langgraph-checkpoint-trust",
      ]);
      assert.equal(r.status, 2);
      const obj = JSON.parse((r.stdout ?? "").trim());
      assert.equal(obj.runKind, "contract_sql_langgraph_checkpoint_trust");
    } finally {
      cleanup();
    }
  });

  it("B happy path: exit 0 with langgraph runKind and checkpoint verdicts", () => {
    const { dir, dbPath, cleanup } = seedDb();
    try {
      const ev = join(dir, "ok.ndjson");
      writeFileSync(ev, toolLineV3({ runEventId: STABLE_RUN_B }), "utf8");
      const r = run([
        "--workflow-id",
        "wf_partner",
        "--events",
        ev,
        "--registry",
        partnerRegistry,
        "--db",
        dbPath,
        "--langgraph-checkpoint-trust",
      ]);
      assert.equal(r.status, 0, r.stderr);
      const obj = JSON.parse((r.stdout ?? "").trim());
      assert.equal(obj.runKind, "contract_sql_langgraph_checkpoint_trust");
      assert.ok(Array.isArray(obj.checkpointVerdicts) && obj.checkpointVerdicts.length >= 1);
      assert.ok(obj.checkpointVerdicts.every((x) => x.verdict === "verified"));
      const want = JSON.parse(readFileSync(ssot.b, "utf8"));
      assert.deepStrictEqual(obj, want);
    } finally {
      cleanup();
    }
  });

  it("C mismatch: exit 1 with checkpoint verdicts present", () => {
    const { dir, dbPath, cleanup } = seedDb();
    try {
      const ev = join(dir, "wr.ndjson");
      writeFileSync(
        ev,
        toolLineV3({
          runEventId: STABLE_RUN_C,
          params: { recordId: "wrong_id", fields: { name: "You", status: "active" } },
        }),
        "utf8",
      );
      const r = run([
        "--workflow-id",
        "wf_partner",
        "--events",
        ev,
        "--registry",
        partnerRegistry,
        "--db",
        dbPath,
        "--langgraph-checkpoint-trust",
      ]);
      assert.equal(r.status, 1);
      const obj = JSON.parse((r.stdout ?? "").trim());
      assert.equal(obj.stateRelation, "does_not_match");
      assert.ok(Array.isArray(obj.checkpointVerdicts));
      const want = JSON.parse(readFileSync(ssot.c, "utf8"));
      assert.deepStrictEqual(obj, want);
    } finally {
      cleanup();
    }
  });

  it("D incomplete: unknown tool yields not_established exit 2", () => {
    const { dir, dbPath, cleanup } = seedDb();
    try {
      const ev = join(dir, "unk.ndjson");
      writeFileSync(ev, toolLineV3({ runEventId: STABLE_RUN_D, toolId: "no.such.tool" }), "utf8");
      const r = run([
        "--workflow-id",
        "wf_partner",
        "--events",
        ev,
        "--registry",
        partnerRegistry,
        "--db",
        dbPath,
        "--langgraph-checkpoint-trust",
        "--no-human-report",
      ]);
      assert.equal(r.status, 2);
      const obj = JSON.parse((r.stdout ?? "").trim());
      assert.equal(obj.stateRelation, "not_established");
      assert.ok(Array.isArray(obj.checkpointVerdicts));
      const want = JSON.parse(readFileSync(ssot.d, "utf8"));
      assert.deepStrictEqual(obj, want);
    } finally {
      cleanup();
    }
  });

  it("assertLangGraphCheckpointProductionGate: B ok; ineligible throws", async () => {
    const m = await import(pathToFileURL(join(root, "dist", "index.js")).href);
    const { dir, dbPath, cleanup } = seedDb();
    let certB;
    try {
      const ev = join(dir, "ok.ndjson");
      writeFileSync(ev, toolLineV3(), "utf8");
      const r = run([
        "--workflow-id",
        "wf_partner",
        "--events",
        ev,
        "--registry",
        partnerRegistry,
        "--db",
        dbPath,
        "--langgraph-checkpoint-trust",
        "--no-human-report",
      ]);
      assert.equal(r.status, 0);
      certB = JSON.parse((r.stdout ?? "").trim());
    } finally {
      cleanup();
    }
    await m.assertLangGraphCheckpointProductionGate(certB);
    const certA2 = m.buildIneligibleLangGraphCheckpointTrustCertificate("wf_x", [
      { code: "MALFORMED_EVENT_LINE", message: "test" },
    ]);
    await assert.rejects(() => m.assertLangGraphCheckpointProductionGate(certA2));
  });
});
