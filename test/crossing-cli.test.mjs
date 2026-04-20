/**
 * agentskeptic crossing: bootstrap-led / pack-led contracts (docs/crossing-normative.md)
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { loadSchemaValidator } from "../dist/schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const seedSql = readFileSync(join(root, "examples", "seed.sql"), "utf8");
const cliJs = join(root, "dist", "cli.js");
const inputJson = join(root, "test", "fixtures", "bootstrap-pack", "input.json");
const eventsBundled = join(root, "examples", "events.ndjson");
const registryBundled = join(root, "examples", "tools.json");

function spawnCli(args) {
  const prev = process.env.NODE_OPTIONS ?? "";
  const flag = "--disable-warning=ExperimentalWarning";
  const nodeOptions = prev.includes("disable-warning") ? prev : `${prev} ${flag}`.trim();
  return spawnSync(process.execPath, [cliJs, ...args], {
    encoding: "utf8",
    cwd: root,
    maxBuffer: 10_000_000,
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  });
}

describe("crossing CLI", () => {
  let tmp;
  let dbPath;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), "crossing-cli-"));
    dbPath = join(tmp, "test.db");
    const db = new DatabaseSync(dbPath);
    db.exec(seedSql);
    db.close();
  });

  it("crossing --help exits 0", () => {
    const r = spawnCli(["crossing", "--help"]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("crossing"));
    assert.equal(r.stderr.trim(), "");
  });

  it("bootstrap-led: stdout is single WorkflowResult JSON line; no bootstrap envelope; stderr ends with Decision-ready footer", () => {
    const outDir = join(tmp, "cross-pack");
    const r = spawnCli([
      "crossing",
      "--bootstrap-input",
      inputJson,
      "--pack-out",
      outDir,
      "--db",
      dbPath,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(!r.stdout.includes("agentskeptic_bootstrap_result"), r.stdout);
    const lines = r.stdout.trim().split(/\r?\n/).filter(Boolean);
    assert.equal(lines.length, 1, r.stdout);
    const wr = JSON.parse(lines[0]);
    const validateResult = loadSchemaValidator("workflow-result");
    assert.equal(validateResult(wr), true);
    assert.equal(wr.status, "complete");
    assert.ok(r.stderr.includes("Decision-ready ProductionComplete"), r.stderr);
    assert.ok(existsSync(join(outDir, "events.ndjson")));
  });

  it("CROSSING_USAGE on --output-lock", () => {
    const r = spawnCli([
      "crossing",
      "--workflow-id",
      "wf_complete",
      "--events",
      eventsBundled,
      "--registry",
      registryBundled,
      "--db",
      dbPath,
      "--output-lock",
      "/tmp/x.json",
    ]);
    assert.equal(r.status, 3);
    assert.equal(r.stdout.trim(), "");
    const err = JSON.parse(r.stderr.trim().split("\n")[0]);
    assert.equal(err.code, "CROSSING_USAGE");
  });

  it("pack-led rejects bundled example paths with exit 2", () => {
    const demoDb = join(root, "examples", "demo.db");
    const r = spawnCli([
      "crossing",
      "--workflow-id",
      "wf_complete",
      "--events",
      eventsBundled,
      "--registry",
      registryBundled,
      "--db",
      demoDb,
    ]);
    assert.equal(r.status, 2, r.stderr);
    assert.ok(r.stderr.includes("INTEGRATOR_OWNED_GATE"), r.stderr);
    assert.equal(r.stdout.trim(), "");
  });

  it("pack-led stdout matches verify-integrator-owned for non-bundled paths", () => {
    const argsIo = [
      "verify-integrator-owned",
      "--workflow-id",
      "wf_complete",
      "--events",
      eventsBundled,
      "--registry",
      registryBundled,
      "--db",
      dbPath,
    ];
    const argsCross = ["crossing", ...argsIo];
    const rIo = spawnCli(argsIo);
    const rCross = spawnCli(argsCross);
    assert.equal(rIo.status, 0, rIo.stderr);
    assert.equal(rCross.status, 0, rCross.stderr);
    assert.equal(rCross.stdout.trim(), rIo.stdout.trim());
    assert.ok(rCross.stderr.includes("Decision-ready ProductionComplete"), rCross.stderr);
  });

  it("bootstrap-led rejects mixing bootstrap flags with pack-led flags", () => {
    const outDir = join(tmp, "cross-mix");
    const r = spawnCli([
      "crossing",
      "--bootstrap-input",
      inputJson,
      "--pack-out",
      outDir,
      "--workflow-id",
      "wf_complete",
      "--events",
      eventsBundled,
      "--registry",
      registryBundled,
      "--db",
      dbPath,
    ]);
    assert.equal(r.status, 3);
    const err = JSON.parse(r.stderr.trim().split("\n")[0]);
    assert.equal(err.code, "CROSSING_USAGE");
  });

  it("bootstrap-led phase-1 failure removes pack-out directory", () => {
    const outDir = join(tmp, "cross-empty");
    const emptyTools = join(root, "test", "fixtures", "bootstrap-pack", "input-empty-tool-calls.json");
    const r = spawnCli(["crossing", "--bootstrap-input", emptyTools, "--pack-out", outDir, "--db", dbPath]);
    assert.equal(r.status, 3, r.stderr);
    assert.ok(!existsSync(outDir), "pack-out should not remain after bootstrap phase-1 failure");
  });
});
