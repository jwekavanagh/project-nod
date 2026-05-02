/**
 * Activation CLI matrix — docs/bootstrap-pack-normative.md
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { loadSchemaValidator } from "../dist/schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const inputJson = join(root, "test", "fixtures", "bootstrap-pack", "input.json");
const inputInconsistent = join(
  root,
  "test",
  "fixtures",
  "bootstrap-pack",
  "input-contract-inconsistent.json",
);
const inputEmptyTools = join(root, "test", "fixtures", "bootstrap-pack", "input-empty-tool-calls.json");
const demoDb = join(root, "examples", "demo.db");

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

describe("activate CLI matrix", () => {
  /** @type {string} */
  let tmpBootstrap;

  before(() => {
    tmpBootstrap = mkdtempSync(join(tmpdir(), "activate-matrix-bootstrap-"));
  });

  /** Non-existent path only (bootstrap `--out` must not exist beforehand). */
  function unusedOut(prefix) {
    return join(
      tmpdir(),
      `${prefix}-${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`,
    );
  }

  it("Case A: decision_ready envelope, proof tree, machine stderr block; bootstrap has no proof", () => {
    const reserved = unusedOut("activate-case-a");
    assert.equal(existsSync(reserved), false);
    const r = spawnCli([
      "activate",
      "--input",
      inputJson,
      "--db",
      demoDb,
      "--out",
      reserved,
    ]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const env = JSON.parse(r.stdout.trim());
    assert.equal(env.kind, "agentskeptic_activate_result");

    const actBlock =
      `AGENTSKEPTIC_ACTIVATION stage=provisional_infer trust_terminal=provisional_pass\n` +
      `AGENTSKEPTIC_ACTIVATION stage=contract_verify trust_terminal=decision_ready\n` +
      `AGENTSKEPTIC_ACTIVATION stage=proof_export path=proof trust_terminal=decision_ready\n`;
    assert.equal(r.stderr, actBlock);

    const manifestPath = join(reserved, "proof", "activation.manifest.json");
    assert.ok(existsSync(join(reserved, "proof", "run", "agent-run.json")));
    assert.ok(existsSync(join(reserved, "proof", "decision", "manifest.json")));
    assert.ok(existsSync(manifestPath));

    const v = loadSchemaValidator("activation-manifest-v1");
    const man = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(v(man), true, JSON.stringify(v.errors ?? []));

    const bootOut = unusedOut("bootstrap-case-a");
    assert.equal(existsSync(bootOut), false);
    const rb = spawnCli(["bootstrap", "--input", inputJson, "--db", demoDb, "--out", bootOut]);
    assert.equal(rb.status, 0, rb.stderr + rb.stdout);
    assert.equal(existsSync(join(bootOut, "proof")), false);
  });

  it("Case B: contract_inconsistent exit 1, proof + manifest trusted terminal", () => {
    const outDir = unusedOut("activate-case-b");
    assert.equal(existsSync(outDir), false);
    const r = spawnCli([
      "activate",
      "--input",
      inputInconsistent,
      "--db",
      demoDb,
      "--out",
      outDir,
    ]);
    assert.equal(r.status, 1, r.stderr + r.stdout);
    const man = JSON.parse(readFileSync(join(outDir, "proof", "activation.manifest.json"), "utf8"));
    assert.equal(man.trustTerminal, "contract_inconsistent");

    const actBlock =
      `AGENTSKEPTIC_ACTIVATION stage=provisional_infer trust_terminal=provisional_pass\n` +
      `AGENTSKEPTIC_ACTIVATION stage=contract_verify trust_terminal=contract_inconsistent\n` +
      `AGENTSKEPTIC_ACTIVATION stage=proof_export path=proof trust_terminal=contract_inconsistent\n`;
    assert.ok(r.stderr.startsWith(actBlock), r.stderr);

    const cert = JSON.parse(r.stdout.trim().split(/\r?\n/).filter(Boolean).pop());
    assert.equal(cert.workflowId, "wf_contract_inconsistent_bootstrap_demo");
    assert.equal(cert.stateRelation, "does_not_match");
  });

  it("Case C: provisional blocked line + BOOTSTRAP_NO_TOOL_CALLS", () => {
    const outDir = unusedOut("activate-case-c");
    assert.equal(existsSync(outDir), false);
    const r = spawnCli(["activate", "--input", inputEmptyTools, "--db", demoDb, "--out", outDir]);
    assert.ok([2, 3].includes(r.status), `status=${r.status} stderr=${r.stderr}`);
    assert.equal(
      r.stderr.split(/\r?\n/).find((l) => l.startsWith("AGENTSKEPTIC_ACTIVATION")),
      "AGENTSKEPTIC_ACTIVATION stage=provisional_infer trust_terminal=blocked",
    );
    assert.ok(r.stderr.includes("BOOTSTRAP_NO_TOOL_CALLS"), r.stderr);
    if (existsSync(outDir)) {
      assert.equal(existsSync(join(outDir, "proof")), false);
    }
  });

  it("beacon builder: activate subcommand merges activation mirror", async () => {
    const outcomeMod = await import(pathToFileURL(join(root, "dist/outcomeCertificate.js")).href);
    const beaconMod = await import(pathToFileURL(join(root, "dist/commercial/verifyOutcomeBeaconBody.js")).href);

    const workflowResult = JSON.parse(
      readFileSync(join(root, "examples", "debug-corpus", "run_complete_b", "workflow-result.json"), "utf8"),
    );

    const certificate = outcomeMod.buildOutcomeCertificateFromWorkflowResult(workflowResult, "contract_sql");

    const stages = [
      { id: "ingest_input", status: "complete", trust_label: "n_a" },
      { id: "provisional_infer", status: "complete", trust_label: "provisional_pass" },
      { id: "contract_verify", status: "complete", trust_label: "decision_ready" },
      { id: "proof_export", status: "complete", trust_label: "decision_ready" },
    ];

    const body = beaconMod.buildVerifyOutcomeBeaconBodyV2({
      run_id: "rid",
      certificate,
      terminal_status: "complete",
      workload_class: "non_bundled",
      subcommand: "activate",
      activation: { trust_terminal: "decision_ready", stages },
    });

    assert.equal(body.subcommand, "activate");
    assert.ok(body.activation);
    assert.equal(body.activation.stages.length, 4);
    assert.equal(body.activation.trust_terminal, "decision_ready");
    assert.equal(body.schema_version, 3);
    assert.equal(body.evidence_gap_primary, "none");
  });
});
