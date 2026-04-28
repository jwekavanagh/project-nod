#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { verifyAgentskeptic } from "../../../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleRoot = join(__dirname, "..");
const dbName = "wfv_golden_next_postgres";

const adminUrl = process.env.POSTGRES_ADMIN_URL?.trim();
if (!adminUrl) {
  console.error("golden:path: set POSTGRES_ADMIN_URL to run the Postgres reference flow");
  process.exit(0);
}

const eventsPath = join(exampleRoot, "agentskeptic", "events.ndjson");
const passEvents = readFileSync(join(exampleRoot, "agentskeptic", "events.pass.ndjson"), "utf8");
const failEvents = readFileSync(join(exampleRoot, "agentskeptic", "events.fail.ndjson"), "utf8");
const seedSql = readFileSync(join(exampleRoot, "db", "seed.sql"), "utf8");

function dbUrlFor(name) {
  const u = new URL(adminUrl);
  u.pathname = "/" + name;
  return u.toString();
}

async function recreateDatabase() {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [dbName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await client.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await client.end();
  }
}

async function seedDatabase() {
  const client = new pg.Client({ connectionString: dbUrlFor(dbName) });
  await client.connect();
  try {
    await client.query(seedSql);
  } finally {
    await client.end();
  }
}

async function runPassCase(databaseUrl) {
  writeFileSync(eventsPath, passEvents);
  const certificate = await verifyAgentskeptic({
    workflowId: "wf_golden_pass",
    databaseUrl,
    projectRoot: exampleRoot,
  });
  assert.equal(certificate.stateRelation, "matches_expectations");
  assert.equal(certificate.highStakesReliance, "permitted");
}

async function runFailCase(databaseUrl) {
  writeFileSync(eventsPath, failEvents);
  const certificate = await verifyAgentskeptic({
    workflowId: "wf_golden_fail",
    databaseUrl,
    projectRoot: exampleRoot,
  });
  assert.equal(certificate.stateRelation, "does_not_match");
  assert.equal(certificate.highStakesReliance, "prohibited");
  assert.equal(
    certificate.explanation.details.some((d) => d.code === "ROW_ABSENT"),
    true,
    "expected ROW_ABSENT in failure details",
  );
}

async function main() {
  await recreateDatabase();
  await seedDatabase();
  const verificationUrl = dbUrlFor(dbName);
  await runPassCase(verificationUrl);
  await runFailCase(verificationUrl);
  console.log("golden:path: pass and fail scenarios verified");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
