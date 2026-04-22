#!/usr/bin/env node
/**
 * One-shot: emit golden Outcome Certificate JSON for python/tests/parity_vectors/.
 * Run from repo root after `npm run build`. Uses node:sqlite + dist/cli.js spawn.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cli = join(root, "dist", "cli.js");
const partnerDir = join(root, "examples", "partner-quickstart");
const partnerRegistry = join(partnerDir, "partner.tools.json");
const partnerEvents = join(partnerDir, "partner.events.ndjson");
const partnerSeed = readFileSync(join(partnerDir, "partner.seed.sql"), "utf8");

const outRoot = join(root, "python", "tests", "parity_vectors");

function seedDb() {
  const dir = mkdtempSync(join(tmpdir(), "parity-golden-"));
  const dbPath = join(dir, "p.db");
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(partnerSeed);
  } finally {
    db.close();
  }
  return { dir, dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function toolLineV3() {
  const line = {
    schemaVersion: 3,
    workflowId: "wf_partner",
    runEventId: randomUUID(),
    type: "tool_observed",
    seq: 0,
    toolId: "crm.upsert_contact",
    params: { recordId: "partner_1", fields: { name: "You", status: "active" } },
    langgraphCheckpoint: {
      threadId: "t-contract",
      checkpointNs: "",
      checkpointId: "cp-contract",
    },
  };
  return `${JSON.stringify(line)}\n`;
}

function main() {
  mkdirSync(join(outRoot, "partner_contract_sql"), { recursive: true });
  mkdirSync(join(outRoot, "partner_langgraph_row_b"), { recursive: true });
  mkdirSync(join(outRoot, "langgraph_a2_malformed"), { recursive: true });

  const { dbPath, cleanup } = seedDb();
  try {
    // contract_sql (v1 events)
    const r1 = runCli([
      "--workflow-id",
      "wf_partner",
      "--events",
      partnerEvents,
      "--registry",
      partnerRegistry,
      "--db",
      dbPath,
    ]);
    if (r1.status !== 0) {
      console.error(r1.stderr);
      throw new Error(`contract_sql verify failed: ${r1.status}`);
    }
    const cert1 = JSON.parse(r1.stdout.trim());
    writeFileSync(
      join(outRoot, "partner_contract_sql", "golden_certificate.json"),
      `${JSON.stringify(cert1, null, 2)}\n`,
      "utf8",
    );

    // LangGraph row B
    const evPath = join(tmpdir(), `lg-b-${randomUUID()}.ndjson`);
    writeFileSync(evPath, toolLineV3(), "utf8");
    const r2 = runCli([
      "--workflow-id",
      "wf_partner",
      "--events",
      evPath,
      "--registry",
      partnerRegistry,
      "--db",
      dbPath,
      "--langgraph-checkpoint-trust",
    ]);
    if (r2.status !== 0) {
      console.error(r2.stderr);
      throw new Error(`langgraph verify failed: ${r2.status}`);
    }
    const cert2 = JSON.parse(r2.stdout.trim());
    writeFileSync(
      join(outRoot, "partner_langgraph_row_b", "golden_certificate.json"),
      `${JSON.stringify(cert2, null, 2)}\n`,
      "utf8",
    );

    // A2 malformed
    const badPath = join(tmpdir(), `lg-a2-${randomUUID()}.ndjson`);
    writeFileSync(badPath, "{not-json\n", "utf8");
    const r3 = runCli([
      "--workflow-id",
      "wf_partner",
      "--events",
      badPath,
      "--registry",
      partnerRegistry,
      "--db",
      dbPath,
      "--langgraph-checkpoint-trust",
    ]);
    if (r3.status !== 2) throw new Error(`expected exit 2, got ${r3.status}`);
    const cert3 = JSON.parse(r3.stdout.trim());
    writeFileSync(
      join(outRoot, "langgraph_a2_malformed", "golden_certificate.json"),
      `${JSON.stringify(cert3, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(join(outRoot, "langgraph_a2_malformed", "golden_exit_code.txt"), "2\n", "utf8");
  } finally {
    cleanup();
  }

  const manifest = {
    cases: [
      {
        id: "partner_contract_sql",
        mode: "contract_sql",
        events: "examples/partner-quickstart/partner.events.ndjson",
        registry: "examples/partner-quickstart/partner.tools.json",
        workflowId: "wf_partner",
      },
      {
        id: "partner_langgraph_row_b",
        mode: "langgraph_checkpoint_trust",
        events_inline: "v3_single_line",
        registry: "examples/partner-quickstart/partner.tools.json",
        workflowId: "wf_partner",
      },
      {
        id: "langgraph_a2_malformed",
        mode: "langgraph_checkpoint_trust",
        events_inline: "malformed_ndjson",
        registry: "examples/partner-quickstart/partner.tools.json",
        workflowId: "wf_partner",
      },
    ],
  };
  writeFileSync(join(outRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log("Wrote goldens to", outRoot);
}

main();
