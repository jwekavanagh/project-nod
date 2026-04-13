/**
 * LangGraph reference verify — shared core (sync). Used by CLI and spawn-order tests.
 * @typedef {import("node:child_process").SpawnSyncReturns} SpawnSyncReturns
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { spawnSync as nodeSpawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function assertMinNode() {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(process.versions.node);
  if (!m) {
    throw new Error("langgraph-reference-verify: OPERATIONAL: could not parse Node.js version");
  }
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (major < 22 || (major === 22 && minor < 13)) {
    throw new Error(
      "langgraph-reference-verify: OPERATIONAL: Node.js >= 22.13 required, got " + process.versions.node,
    );
  }
}

/**
 * @param {string} eventsPath
 */
function assertEmitterContract(eventsPath) {
  let raw;
  try {
    raw = readFileSync(eventsPath, "utf8").trim();
  } catch {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: cannot read events file");
  }
  const lines = raw.split(/\n/).filter((l) => l.length > 0);
  if (lines.length !== 1) {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: expected exactly one NDJSON line");
  }
  let ev;
  try {
    ev = JSON.parse(lines[0]);
  } catch {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: invalid JSON");
  }
  const requiredTop = ["schemaVersion", "workflowId", "seq", "type", "toolId", "params"];
  for (const k of requiredTop) {
    if (!(k in ev)) {
      throw new Error(`langgraph-reference-verify: EMITTER_CONTRACT: missing top-level key ${k}`);
    }
  }
  if (ev.schemaVersion !== 1) {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: schemaVersion");
  }
  if (ev.type !== "tool_observed") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: type");
  }
  if (ev.workflowId !== "wf_partner") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: workflowId");
  }
  if (Number(ev.seq) !== 0) {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: seq");
  }
  if (ev.toolId !== "crm.upsert_contact") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: toolId");
  }
  const p = ev.params;
  if (p === null || typeof p !== "object") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: params");
  }
  const pKeys = Object.keys(p).sort();
  if (pKeys.join(",") !== "fields,recordId") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: params keys must be exactly recordId,fields");
  }
  if (p.recordId !== "partner_1") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: recordId");
  }
  const f = p.fields;
  if (f === null || typeof f !== "object") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: fields");
  }
  const fKeys = Object.keys(f).sort();
  if (fKeys.join(",") !== "name,status") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: fields keys must be exactly name,status");
  }
  if (f.name !== "You" || f.status !== "active") {
    throw new Error("langgraph-reference-verify: EMITTER_CONTRACT: fields values");
  }
}

/**
 * @param {typeof nodeSpawnSync} spawnSyncImpl
 * @param {string[]} argv [command, ...args] — must include dist/cli.js in args
 * @param {string} cwd
 * @returns {SpawnSyncReturns}
 */
function spawnCli(spawnSyncImpl, argv, cwd) {
  const cmd = argv[0];
  const args = argv.slice(1);
  const hasCli = args.some(
    (a) => typeof a === "string" && a.replace(/\\/g, "/").endsWith("dist/cli.js"),
  );
  if (!hasCli) {
    throw new Error("langgraph-reference-verify: OPERATIONAL: spawnCli argv must include dist/cli.js");
  }
  return spawnSyncImpl(cmd, args, { encoding: "utf8", cwd, env: process.env });
}

function parseWorkflowResult(stdout) {
  let obj;
  try {
    obj = JSON.parse((stdout ?? "").trim());
  } catch {
    throw new Error("langgraph-reference-verify: OPERATIONAL: CLI stdout is not JSON");
  }
  return obj;
}

function assertVerifiedStdout(stdout) {
  const obj = parseWorkflowResult(stdout);
  if (obj.status !== "complete") {
    throw new Error(
      "langgraph-reference-verify: OPERATIONAL: expected status complete, got " + JSON.stringify(obj.status),
    );
  }
  const step0 = obj.steps?.[0];
  if (!step0 || step0.status !== "verified") {
    throw new Error("langgraph-reference-verify: OPERATIONAL: expected first step verified");
  }
}

function assertNegativeStdout(stdout) {
  const obj = parseWorkflowResult(stdout);
  if (obj.status !== "inconsistent") {
    throw new Error("langgraph-reference-verify: NEGATIVE_PHASE: expected inconsistent");
  }
  const step0 = obj.steps?.[0];
  if (!step0 || step0.status !== "missing") {
    throw new Error("langgraph-reference-verify: NEGATIVE_PHASE: expected step missing");
  }
  const hasRowAbsent = Array.isArray(step0.reasons) && step0.reasons.some((x) => x.code === "ROW_ABSENT");
  if (!hasRowAbsent) {
    throw new Error("langgraph-reference-verify: NEGATIVE_PHASE: expected ROW_ABSENT");
  }
}

/**
 * Full pipeline: npm ci in example, emit NDJSON, assert contract, happy SQLite verify, negative verify.
 *
 * When `options.eventsPath` is a non-empty string, only runs `assertEmitterContract` on that path
 * (for spawn-order tests; no subprocesses). Production CLI must not set this.
 *
 * @param {{
 *   spawnSync?: typeof nodeSpawnSync;
 *   root?: string;
 *   eventsPath?: string;
 * }} [options]
 * @returns {undefined}
 */
export function executeLanggraphReferencePipeline(options = {}) {
  const spawnSyncImpl = options.spawnSync ?? nodeSpawnSync;
  const pipelineRoot = options.root ?? repoRoot;

  assertMinNode();

  const probePath =
    typeof options.eventsPath === "string" && options.eventsPath.length > 0 ? options.eventsPath : null;
  if (probePath) {
    assertEmitterContract(probePath);
    return undefined;
  }

  const partnerDir = path.join(pipelineRoot, "examples", "partner-quickstart");
  const registryPath = path.join(partnerDir, "partner.tools.json");
  const seedPath = path.join(partnerDir, "partner.seed.sql");
  const seedSql = readFileSync(seedPath, "utf8");

  const examplePrefix = path.join(pipelineRoot, "examples", "langgraph-reference");
  const npmR = spawnSyncImpl("npm", ["ci", "--prefix", examplePrefix], {
    cwd: pipelineRoot,
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
  if (npmR.status !== 0) {
    throw new Error(
      "langgraph-reference-verify: OPERATIONAL: npm ci failed:\n" + (npmR.stderr || npmR.stdout || ""),
    );
  }

  const eventsPath = path.join(tmpdir(), `lg-ref-${randomUUID()}.ndjson`);
  const runScript = path.join(examplePrefix, "run.mjs");
  const runR = spawnSyncImpl(process.execPath, [runScript, eventsPath], {
    cwd: pipelineRoot,
    encoding: "utf8",
    env: process.env,
  });
  if (runR.status !== 0) {
    throw new Error("langgraph-reference-verify: OPERATIONAL: run.mjs failed:\n" + (runR.stderr || runR.stdout || ""));
  }

  assertEmitterContract(eventsPath);

  const cliPath = path.join(pipelineRoot, "dist", "cli.js");
  if (!existsSync(cliPath)) {
    try {
      unlinkSync(eventsPath);
    } catch {
      /* ignore */
    }
    throw new Error("langgraph-reference-verify: OPERATIONAL: dist/cli.js missing; run npm run build");
  }

  const dbFile = path.join(tmpdir(), `lg-partner-${randomUUID()}.db`);
  try {
    const db = new DatabaseSync(dbFile);
    try {
      db.exec(seedSql);
    } finally {
      db.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      unlinkSync(eventsPath);
    } catch {
      /* ignore */
    }
    throw new Error("langgraph-reference-verify: OPERATIONAL: sqlite seed failed: " + msg);
  }

  const happy = spawnCli(
    spawnSyncImpl,
    [
      process.execPath,
      cliPath,
      "--workflow-id",
      "wf_partner",
      "--events",
      eventsPath,
      "--registry",
      registryPath,
      "--db",
      dbFile,
    ],
    pipelineRoot,
  );
  try {
    unlinkSync(dbFile);
  } catch {
    /* ignore */
  }
  if (happy.status !== 0) {
    try {
      unlinkSync(eventsPath);
    } catch {
      /* ignore */
    }
    throw new Error(
      "langgraph-reference-verify: OPERATIONAL: happy verify CLI exited " +
        happy.status +
        "\n" +
        (happy.stderr || happy.stdout || ""),
    );
  }
  assertVerifiedStdout(happy.stdout);
  try {
    unlinkSync(eventsPath);
  } catch {
    /* ignore */
  }

  const badPath = path.join(tmpdir(), `lg-bad-${randomUUID()}.ndjson`);
  const badLine =
    JSON.stringify({
      schemaVersion: 1,
      workflowId: "wf_partner",
      seq: 0,
      type: "tool_observed",
      toolId: "crm.upsert_contact",
      params: {
        recordId: "wrong_id",
        fields: { name: "You", status: "active" },
      },
    }) + "\n";
  writeFileSync(badPath, badLine, "utf8");

  const db2 = path.join(tmpdir(), `lg-partner2-${randomUUID()}.db`);
  try {
    const db = new DatabaseSync(db2);
    try {
      db.exec(seedSql);
    } finally {
      db.close();
    }
  } catch (e) {
    try {
      unlinkSync(badPath);
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error("langgraph-reference-verify: OPERATIONAL: sqlite seed (negative) failed: " + msg);
  }

  const neg = spawnCli(
    spawnSyncImpl,
    [
      process.execPath,
      cliPath,
      "--workflow-id",
      "wf_partner",
      "--events",
      badPath,
      "--registry",
      registryPath,
      "--db",
      db2,
    ],
    pipelineRoot,
  );
  try {
    unlinkSync(db2);
  } catch {
    /* ignore */
  }
  try {
    unlinkSync(badPath);
  } catch {
    /* ignore */
  }

  if (neg.status !== 1) {
    throw new Error("langgraph-reference-verify: NEGATIVE_PHASE: expected CLI exit 1, got " + neg.status);
  }
  assertNegativeStdout(neg.stdout);
  return undefined;
}
