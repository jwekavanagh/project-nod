/**
 * Consumer-project E2E: npm pack → temp consumer → install tarball → verifyAgentskeptic scenarios.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const TOOLS_JSON = JSON.stringify([
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
]);

function readPkgVersion() {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  return String(pkg.version);
}

function runBuildAndPack(packDest) {
  const shell = process.platform === "win32";
  const build = spawnSync("npm", ["run", "build"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell,
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const pack = spawnSync("npm", ["pack", "--pack-destination", packDest], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell,
  });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  const version = readPkgVersion();
  const tgz = join(packDest, `agentskeptic-${version}.tgz`);
  assert.ok(existsSync(tgz), `expected tarball ${tgz}`);
  return tgz;
}

function npmInitInstall(consumerDir, tgzPath) {
  const shell = process.platform === "win32";
  const init = spawnSync("npm", ["init", "-y"], {
    cwd: consumerDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell,
  });
  assert.equal(init.status, 0, init.stderr);

  const pkgPath = join(consumerDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.type = "module";
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  const inst = spawnSync("npm", ["install", tgzPath], {
    cwd: consumerDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell,
  });
  assert.equal(inst.status, 0, inst.stderr || inst.stdout);
}

test("consumer E2E: verifyAgentskeptic scenarios via packed tarball", async () => {
  const packDest = mkdtempSync(join(tmpdir(), "as-pack-"));
  const consumerDir = mkdtempSync(join(tmpdir(), "as-consumer-"));
  try {
    const tgz = runBuildAndPack(packDest);
    npmInitInstall(consumerDir, tgz);

    const asDir = join(consumerDir, "agentskeptic");
    mkdirSync(asDir, { recursive: true });
    writeFileSync(join(asDir, "tools.json"), `${TOOLS_JSON}\n`);

    const eventOk = {
      schemaVersion: 1,
      workflowId: "e2e_ok",
      seq: 0,
      type: "tool_observed",
      toolId: "crm.upsert_contact",
      params: { recordId: "c_ok", fields: { name: "Alice", status: "active" } },
    };
    const dbPath = join(consumerDir, "app.db");
    const { DatabaseSync } = await import("node:sqlite");
    {
      const db = new DatabaseSync(dbPath);
      db.exec(
        "CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT, status TEXT); INSERT INTO contacts VALUES ('c_ok','Alice','active');",
      );
      db.close();
    }

    writeFileSync(join(asDir, "events.ndjson"), `${JSON.stringify(eventOk)}\n`);

    const runnerA = `import { verifyAgentskeptic } from 'agentskeptic';
const certificate = await verifyAgentskeptic({ workflowId: 'e2e_ok', databaseUrl: 'app.db' });
if (certificate.stateRelation !== 'matches_expectations' || certificate.highStakesReliance !== 'permitted') process.exit(2);
process.exit(0);
`;
    writeFileSync(join(consumerDir, "run-a.mjs"), runnerA);
    const a = spawnSync(process.execPath, ["run-a.mjs"], {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(a.status, 0, a.stderr || a.stdout);

    const eventBad = {
      ...eventOk,
      workflowId: "e2e_bad",
      params: { recordId: "missing_row", fields: { name: "x", status: "y" } },
    };
    writeFileSync(join(asDir, "events.ndjson"), `${JSON.stringify(eventBad)}\n`);

    const runnerB = `import { verifyAgentskeptic } from 'agentskeptic';
const certificate = await verifyAgentskeptic({ workflowId: 'e2e_bad', databaseUrl: 'app.db' });
if (certificate.stateRelation !== 'does_not_match' || certificate.highStakesReliance !== 'prohibited') process.exit(3);
if (!certificate.explanation.details.some((d) => d.code === 'ROW_ABSENT')) process.exit(4);
process.exit(0);
`;
    writeFileSync(join(consumerDir, "run-b.mjs"), runnerB);
    const b = spawnSync(process.execPath, ["run-b.mjs"], {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(b.status, 0, b.stderr || b.stdout);

    writeFileSync(join(asDir, "events.ndjson"), `${JSON.stringify(eventOk)}\n`);
    unlinkSync(join(asDir, "tools.json"));

    const expectedToolsPath = normalize(join(consumerDir, "agentskeptic", "tools.json"));
    const runnerC = `import { verifyAgentskeptic, TruthLayerError } from 'agentskeptic';
try {
  await verifyAgentskeptic({ workflowId: 'e2e_ok', databaseUrl: 'app.db' });
  process.exit(5);
} catch (e) {
  if (!(e instanceof TruthLayerError)) process.exit(6);
  const msg = String(e.message);
  if (!msg.includes(${JSON.stringify(expectedToolsPath)})) process.exit(7);
  process.exit(0);
}
`;
    writeFileSync(join(consumerDir, "run-c.mjs"), runnerC);
    const c = spawnSync(process.execPath, ["run-c.mjs"], {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(c.status, 0, c.stderr || c.stdout);
  } finally {
    rmSync(packDest, { recursive: true, force: true });
    rmSync(consumerDir, { recursive: true, force: true });
  }
});

test("consumer E2E: canonical Postgres verification scenario", async (t) => {
  const adminUrl = process.env.POSTGRES_ADMIN_URL?.trim();
  if (!adminUrl) {
    t.skip("POSTGRES_ADMIN_URL is required for Postgres consumer E2E");
    return;
  }

  const packDest = mkdtempSync(join(tmpdir(), "as-pack-pg-"));
  const consumerDir = mkdtempSync(join(tmpdir(), "as-consumer-pg-"));
  const dbName = "wfv_consumer_e2e_pg";
  const { default: pg } = await import("pg");

  const databaseUrl = (() => {
    const u = new URL(adminUrl);
    u.pathname = "/" + dbName;
    return u.href;
  })();

  const adminClient = new pg.Client({ connectionString: adminUrl });
  try {
    const tgz = runBuildAndPack(packDest);
    npmInitInstall(consumerDir, tgz);
    const asDir = join(consumerDir, "agentskeptic");
    mkdirSync(asDir, { recursive: true });
    writeFileSync(join(asDir, "tools.json"), `${TOOLS_JSON}\n`);
    try {
      await adminClient.connect();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/password authentication failed/i.test(message)) {
        t.skip("POSTGRES_ADMIN_URL rejected credentials in this environment");
        return;
      }
      throw e;
    }
    await adminClient.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [dbName],
    );
    await adminClient.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await adminClient.query(`CREATE DATABASE ${dbName}`);
    await adminClient.end();

    const dbClient = new pg.Client({ connectionString: databaseUrl });
    await dbClient.connect();
    await dbClient.query(
      "CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT, status TEXT); INSERT INTO contacts VALUES ('c_ok','Alice','active');",
    );
    await dbClient.end();

    const eventOk = {
      schemaVersion: 1,
      workflowId: "e2e_pg_ok",
      seq: 0,
      type: "tool_observed",
      toolId: "crm.upsert_contact",
      params: { recordId: "c_ok", fields: { name: "Alice", status: "active" } },
    };
    const eventBad = {
      ...eventOk,
      workflowId: "e2e_pg_bad",
      params: { recordId: "missing_row", fields: { name: "x", status: "y" } },
    };

    writeFileSync(join(asDir, "events.ndjson"), `${JSON.stringify(eventOk)}\n`);
    const runnerA = `import { verifyAgentskeptic } from 'agentskeptic';
const certificate = await verifyAgentskeptic({ workflowId: 'e2e_pg_ok', databaseUrl: ${JSON.stringify(databaseUrl)} });
if (certificate.stateRelation !== 'matches_expectations' || certificate.highStakesReliance !== 'permitted') process.exit(2);
process.exit(0);
`;
    writeFileSync(join(consumerDir, "run-pg-a.mjs"), runnerA);
    const a = spawnSync(process.execPath, ["run-pg-a.mjs"], {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(a.status, 0, a.stderr || a.stdout);

    writeFileSync(join(asDir, "events.ndjson"), `${JSON.stringify(eventBad)}\n`);
    const runnerB = `import { verifyAgentskeptic } from 'agentskeptic';
const certificate = await verifyAgentskeptic({ workflowId: 'e2e_pg_bad', databaseUrl: ${JSON.stringify(databaseUrl)} });
if (certificate.stateRelation !== 'does_not_match' || certificate.highStakesReliance !== 'prohibited') process.exit(3);
if (!certificate.explanation.details.some((d) => d.code === 'ROW_ABSENT')) process.exit(4);
process.exit(0);
`;
    writeFileSync(join(consumerDir, "run-pg-b.mjs"), runnerB);
    const b = spawnSync(process.execPath, ["run-pg-b.mjs"], {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(b.status, 0, b.stderr || b.stdout);
  } finally {
    try {
      if (adminClient) {
        await adminClient.connect();
        await adminClient.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [dbName],
        );
        await adminClient.query(`DROP DATABASE IF EXISTS ${dbName}`);
        await adminClient.end();
      }
    } catch {}
    rmSync(packDest, { recursive: true, force: true });
    rmSync(consumerDir, { recursive: true, force: true });
  }
});
