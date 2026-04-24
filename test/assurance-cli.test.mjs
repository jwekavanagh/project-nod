/**
 * agentskeptic assurance run | stale: manifest sweep, staleness, failure modes, AssuranceOutputV1 envelope.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "child_process";
import { loadSchemaValidator } from "../dist/schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const committedManifest = join(root, "examples", "assurance", "manifest.json");
const mismatchPrior = join(root, "test", "fixtures", "assurance", "compare-mismatch-prior.json");
const mismatchCurrent = join(root, "test", "fixtures", "assurance", "compare-mismatch-current.json");

function runAssurance(args, env) {
  return spawnSync(process.execPath, ["--no-warnings", cliJs, "assurance", ...args], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, ...env },
  });
}

function parseEnvelope(stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter((l) => l.length > 0);
  assert.equal(lines.length, 1, `expected single stdout line, got ${lines.length}`);
  return JSON.parse(lines[0]);
}

describe("assurance CLI", () => {
  it("assurance run with committed manifest exits 0 and emits valid AssuranceOutputV1 envelope", () => {
    const r = runAssurance(["run", "--manifest", committedManifest]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const envl = parseEnvelope(r.stdout);
    const vo = loadSchemaValidator("assurance-output-v1");
    assert.equal(vo(envl), true, JSON.stringify(vo.errors ?? []));
    assert.equal(envl.kind, "assurance_run");
    const vr = loadSchemaValidator("assurance-run-report-v1");
    assert.equal(vr(envl.runReport), true);
    assert.equal(envl.runReport.scenarios.length, 1);
    assert.ok(envl.runReport.scenarios.every((s) => s.exitCode === 0));
    assert.match(envl.operatorLine, /^run: ok$/);
    assert.ok(Array.isArray(envl.firstFiveMinutesChecklist));
    assert.ok(envl.firstFiveMinutesChecklist.length >= 1);
  });

  it("assurance stale exits 1 when issuedAt is too old and emits envelope only on stdout", () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-as-stale-"));
    try {
      const p = join(dir, "report.json");
      writeFileSync(
        p,
        JSON.stringify({
          schemaVersion: 1,
          issuedAt: "2000-01-01T00:00:00.000Z",
          scenarios: [{ id: "x", exitCode: 0 }],
        }),
        "utf8",
      );
      const r = runAssurance(["stale", "--report", p, "--max-age-hours", "24"]);
      assert.equal(r.status, 1);
      assert.equal((r.stderr || "").trim(), "");
      const envl = parseEnvelope(r.stdout);
      const v = loadSchemaValidator("assurance-output-v1");
      assert.equal(v(envl), true);
      assert.equal(envl.kind, "assurance_stale");
      assert.equal(envl.fresh, false);
      assert.match(envl.operatorLine, /^stale: exceeds_max_age /);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assurance stale exits 0 when fresh with empty stderr", () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-as-fresh-"));
    try {
      const p = join(dir, "report.json");
      writeFileSync(
        p,
        JSON.stringify({
          schemaVersion: 1,
          issuedAt: new Date().toISOString(),
          scenarios: [{ id: "x", exitCode: 0 }],
        }),
        "utf8",
      );
      const r = runAssurance(["stale", "--report", p, "--max-age-hours", "24"]);
      assert.equal(r.status, 0);
      assert.equal((r.stderr || "").trim(), "");
      const envl = parseEnvelope(r.stdout);
      assert.equal(envl.kind, "assurance_stale");
      assert.equal(envl.fresh, true);
      assert.match(envl.operatorLine, /^stale: fresh /);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assurance stale exits 3 when issuedAt is far in the future", () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-as-future-"));
    try {
      const p = join(dir, "report.json");
      const far = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      writeFileSync(
        p,
        JSON.stringify({
          schemaVersion: 1,
          issuedAt: far,
          scenarios: [{ id: "x", exitCode: 0 }],
        }),
        "utf8",
      );
      const r = runAssurance(["stale", "--report", p, "--max-age-hours", "24"]);
      assert.equal(r.status, 3);
      assert.equal(r.stdout.trim(), "");
      const err = JSON.parse(r.stderr.trim());
      assert.equal(err.code, "ASSURANCE_REPORT_ISSUED_AT_FUTURE_SKEW");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assurance stale exits 3 when report path missing", () => {
    const r = runAssurance([
      "stale",
      "--report",
      join(root, "this-path-does-not-exist-assurance.json"),
      "--max-age-hours",
      "1",
    ]);
    assert.equal(r.status, 3);
    const err = JSON.parse(r.stderr.trim());
    assert.equal(err.code, "ASSURANCE_REPORT_READ_FAILED");
  });

  it("assurance stale exits 3 on malformed JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-as-bad-"));
    try {
      const p = join(dir, "bad.json");
      writeFileSync(p, "{", "utf8");
      const r = runAssurance(["stale", "--report", p, "--max-age-hours", "24"]);
      assert.equal(r.status, 3);
      const err = JSON.parse(r.stderr.trim());
      assert.equal(err.code, "ASSURANCE_REPORT_JSON_SYNTAX");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assurance run exits 3 when manifest references missing path", () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-as-miss-"));
    try {
      const mpath = join(dir, "manifest.json");
      writeFileSync(
        mpath,
        JSON.stringify({
          schemaVersion: 1,
          scenarios: [
            {
              id: "bad",
              kind: "spawn_argv",
              argv: ["compare", "--prior", "nope-not-a-file.json", "--current", mismatchCurrent],
            },
          ],
        }),
        "utf8",
      );
      const r = runAssurance(["run", "--manifest", mpath]);
      assert.equal(r.status, 3);
      const err = JSON.parse(r.stderr.trim());
      assert.equal(err.code, "ASSURANCE_MANIFEST_PATH_MISSING");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assurance run exits 1 when compare workflowId mismatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-as-cmp-"));
    try {
      const mpath = join(dir, "manifest.json");
      writeFileSync(
        mpath,
        JSON.stringify({
          schemaVersion: 1,
          scenarios: [
            {
              id: "mismatch_compare",
              kind: "spawn_argv",
              argv: ["compare", "--prior", mismatchPrior, "--current", mismatchCurrent],
            },
          ],
        }),
        "utf8",
      );
      const r = runAssurance(["run", "--manifest", mpath]);
      assert.equal(r.status, 1);
      const envl = parseEnvelope(r.stdout);
      assert.equal(envl.kind, "assurance_run");
      assert.equal(envl.runReport.scenarios[0].exitCode, 3);
      assert.equal(envl.runReport.scenarios[0].id, "mismatch_compare");
      assert.match(envl.operatorLine, /mismatch_compare=3/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assurance run --write-report writes same bytes as stdout envelope", () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-as-wr-"));
    try {
      const out = join(dir, "out.json");
      const r = runAssurance(["run", "--manifest", committedManifest, "--write-report", out]);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(readFileSync(out, "utf8"), r.stdout);
      const envl = JSON.parse(readFileSync(out, "utf8"));
      const v = loadSchemaValidator("assurance-output-v1");
      assert.equal(v(envl), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assurance run maps spawn timeout to exitCode 124", () => {
    const dir = mkdtempSync(join(tmpdir(), "etl-as-to-"));
    try {
      const mpath = join(dir, "manifest.json");
      const corpus = join(root, "test", "fixtures", "debug-ui-compare");
      writeFileSync(
        mpath,
        JSON.stringify({
          schemaVersion: 1,
          scenarios: [
            {
              id: "debug_server_blocks",
              kind: "spawn_argv",
              argv: ["debug", "--corpus", corpus, "--port", "0"],
            },
          ],
        }),
        "utf8",
      );
      const r = runAssurance(["run", "--manifest", mpath], {
        AGENTSKEPTIC_ASSURANCE_SCENARIO_TIMEOUT_MS: "400",
      });
      assert.equal(r.status, 1);
      const envl = parseEnvelope(r.stdout);
      assert.equal(envl.runReport.scenarios[0].exitCode, 124);
      assert.match(envl.operatorLine, /debug_server_blocks=124/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
