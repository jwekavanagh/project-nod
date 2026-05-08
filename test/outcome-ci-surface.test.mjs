/**
 * Unit tests for `.github/actions/agentskeptic-check/outcome-ci-surface.mjs`.
 *
 * Drives the renderer with fixture stdout/stderr files, captures the produced
 * GITHUB_STEP_SUMMARY + GITHUB_OUTPUT, and asserts the contract documented in
 * docs/ambient-ci-distribution.md (also see plan: github_ci_visibility_mvp).
 *
 * Goldens are stored as `*.expected.md` and `*.expected.kv` next to each
 * fixture. The artifact dir is normalized to `<ARTIFACT_DIR>` before compare.
 *
 * Refresh goldens (only when intentionally changing the contract):
 *   AS_RENDER_GOLDEN_REFRESH=1 node --test test/outcome-ci-surface.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const renderer = join(root, ".github", "actions", "agentskeptic-check", "outcome-ci-surface.mjs");
const fixturesDir = join(root, "test", "fixtures", "outcome-ci-surface");

const PLACEHOLDER_ARTIFACT_DIR = "<ARTIFACT_DIR>";
const REFRESH = process.env.AS_RENDER_GOLDEN_REFRESH === "1";

function runRenderer({ stdoutFile, stderrFile, verdict, mode = "check", cliExit = "0" }) {
  const tmp = mkdtempSync(join(tmpdir(), "as-ren-"));
  const outP = join(tmp, "OUT");
  const sumP = join(tmp, "SUM");
  const artifactDir = join(tmp, "agentskeptic-ci");
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(outP, "");
  writeFileSync(sumP, "");

  const env = {
    ...process.env,
    GITHUB_OUTPUT: outP,
    GITHUB_STEP_SUMMARY: sumP,
    RUNNER_TEMP: tmp,
  };
  const r = spawnSync(
    process.execPath,
    [
      renderer,
      "--stdout-file", stdoutFile,
      "--stderr-file", stderrFile,
      "--cli-exit", cliExit,
      "--mode", mode,
      "--verdict", verdict ?? "",
      "--artifact-dir", artifactDir,
    ],
    { encoding: "utf8", env },
  );
  return {
    rc: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    summary: readFileSync(sumP, "utf8"),
    outputsRaw: readFileSync(outP, "utf8"),
    outputs: parseOutputsKv(readFileSync(outP, "utf8")),
    artifactDir,
    artifactPath: join(artifactDir, "outcome-certificate.json"),
  };
}

function parseOutputsKv(raw) {
  const out = {};
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const heredocStart = line.match(/^([^=<]+?)<<(.+)$/);
    if (heredocStart) {
      const [_, key, delim] = heredocStart;
      const body = [];
      i++;
      while (i < lines.length && lines[i] !== delim) { body.push(lines[i]); i++; }
      out[key] = body.join("\n");
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0) out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

function normalizePaths(text, artifactDir) {
  // Normalize both the absolute artifactDir and any forward-slash form (Node on Windows
  // joins with `\`, but the renderer uses `path.join` which produces `\` on win32).
  const candidates = [artifactDir, artifactDir.replace(/\\/g, "/")];
  let out = text;
  for (const c of candidates) {
    if (!c) continue;
    out = out.split(c).join(PLACEHOLDER_ARTIFACT_DIR);
  }
  return out;
}

function compareGolden(actual, goldenPath) {
  if (REFRESH) {
    writeFileSync(goldenPath, actual);
    return;
  }
  if (!existsSync(goldenPath)) {
    writeFileSync(goldenPath, actual);
    assert.fail(`Golden ${goldenPath} did not exist; wrote initial copy. Re-run tests.`);
  }
  const expected = readFileSync(goldenPath, "utf8");
  assert.equal(actual, expected, `Golden mismatch: ${goldenPath}`);
}

function caseGoldens(name) {
  return {
    summary: join(fixturesDir, `${name}.expected.md`),
    outputs: join(fixturesDir, `${name}.expected.kv`),
  };
}

// ---------- cert: trusted ----------

test("trusted certificate: writes artifact, populates structured outputs, summary shows trust spine", () => {
  const stdoutFile = join(fixturesDir, "trusted.cert.json");
  const stderrFile = join(fixturesDir, "_empty.stderr");
  if (!existsSync(stderrFile)) writeFileSync(stderrFile, "truth_check_verdict: trusted\nhuman line\n");

  const r = runRenderer({ stdoutFile, stderrFile, verdict: "trusted" });
  assert.equal(r.rc, 0, r.stderr);
  assert.ok(existsSync(r.artifactPath), "artifact file should exist");

  // Parsed cert is byte-identical to fixture content (after JSON round-trip)
  const fixture = JSON.parse(readFileSync(stdoutFile, "utf8"));
  const written = JSON.parse(readFileSync(r.artifactPath, "utf8"));
  assert.deepEqual(written, fixture);

  assert.equal(r.outputs["state-relation"], "matches_expectations");
  assert.equal(r.outputs["trust-decision"], "safe");
  assert.equal(r.outputs["failing-tool-ids"], "");
  assert.equal(r.outputs["primary-reason-codes"], "VERIFIED");
  assert.equal(r.outputs["failing-witness-kinds"], "");
  assert.equal(r.outputs["recommended-action"], "none");
  assert.equal(r.outputs["automation-safe"], "true");
  assert.equal(r.outputs["certificate-path"], r.artifactPath);

  const golden = caseGoldens("trusted");
  compareGolden(normalizePaths(r.summary, r.artifactDir), golden.summary);
  compareGolden(normalizePaths(r.outputsRaw, r.artifactDir), golden.outputs);
});

// ---------- cert: step failure ----------

test("step failure: per-step table from remediationItems with reason codes and tool id", () => {
  const stdoutFile = join(fixturesDir, "step-fail.cert.json");
  const stderrFile = join(fixturesDir, "_empty.stderr");
  if (!existsSync(stderrFile)) writeFileSync(stderrFile, "truth_check_verdict: not_trusted\n");

  const r = runRenderer({ stdoutFile, stderrFile, verdict: "not_trusted" });
  assert.equal(r.rc, 0, r.stderr);

  assert.equal(r.outputs["state-relation"], "does_not_match");
  assert.equal(r.outputs["trust-decision"], "unsafe");
  assert.equal(r.outputs["failing-tool-ids"], "orders.insert");
  assert.equal(r.outputs["primary-reason-codes"], "OBJECT_MISSING,STATE_MISMATCH");
  assert.equal(r.outputs["failing-witness-kinds"], "object_storage,sql");
  assert.equal(r.outputs["recommended-action"], "reconcile_downstream_state");
  assert.equal(r.outputs["automation-safe"], "false");
  assert.ok(r.outputs["certificate-path"].endsWith("outcome-certificate.json"));

  // Summary contains structured table row
  assert.match(r.summary, /\| 1 \| step \| orders\.insert \|/);
  assert.match(r.summary, /STATE_MISMATCH/);
  assert.match(r.summary, /reconcile_downstream_state/);

  const golden = caseGoldens("step-fail");
  compareGolden(normalizePaths(r.summary, r.artifactDir), golden.summary);
  compareGolden(normalizePaths(r.outputsRaw, r.artifactDir), golden.outputs);
});

// ---------- cert: effect failure ----------

test("effect failure: rows show effect <id> on step <seq> and witness kinds derive from prefixes", () => {
  const stdoutFile = join(fixturesDir, "effect-fail.cert.json");
  const stderrFile = join(fixturesDir, "_empty.stderr");
  if (!existsSync(stderrFile)) writeFileSync(stderrFile, "truth_check_verdict: not_trusted\n");

  const r = runRenderer({ stdoutFile, stderrFile, verdict: "not_trusted" });
  assert.equal(r.rc, 0, r.stderr);

  assert.equal(r.outputs["state-relation"], "does_not_match");
  assert.equal(r.outputs["primary-reason-codes"], "HTTP_WITNESS_STATUS_MISMATCH,VECTOR_NOT_FOUND");
  assert.equal(r.outputs["failing-witness-kinds"], "http_witness,vector_document");
  assert.equal(r.outputs["recommended-action"], "resolve_multi_effect_failures");
  assert.equal(r.outputs["automation-safe"], "false");

  assert.match(r.summary, /\| 2 \| effect \| effect: receipt_doc \|/);
  assert.match(r.summary, /\| 2 \| effect \| effect: http_receipt \|/);

  const golden = caseGoldens("effect-fail");
  compareGolden(normalizePaths(r.summary, r.artifactDir), golden.summary);
  compareGolden(normalizePaths(r.outputsRaw, r.artifactDir), golden.outputs);
});

// ---------- cert: incomplete (not_established) ----------

test("incomplete: trust decision unknown; recommended action surfaced", () => {
  const stdoutFile = join(fixturesDir, "incomplete.cert.json");
  const stderrFile = join(fixturesDir, "_empty.stderr");
  if (!existsSync(stderrFile)) writeFileSync(stderrFile, "truth_check_verdict: unknown\n");

  const r = runRenderer({ stdoutFile, stderrFile, verdict: "unknown" });
  assert.equal(r.rc, 0, r.stderr);

  assert.equal(r.outputs["state-relation"], "not_established");
  assert.equal(r.outputs["trust-decision"], "unknown");
  assert.equal(r.outputs["recommended-action"], "fix_event_ingest_and_steps");
  assert.equal(r.outputs["primary-reason-codes"], "INGEST_NO_STRUCTURED_TOOL_ACTIVITY");
  // No step/effect remediation rows — table is empty placeholder
  assert.match(r.summary, /_\(no failing steps\)_/);

  const golden = caseGoldens("incomplete");
  compareGolden(normalizePaths(r.summary, r.artifactDir), golden.summary);
  compareGolden(normalizePaths(r.outputsRaw, r.artifactDir), golden.outputs);
});

// ---------- cert: langgraph-checkpoint section ----------

test("langgraph-checkpoint trusted: checkpoint verdicts table appears", () => {
  const stdoutFile = join(fixturesDir, "langgraph-checkpoint.cert.json");
  const stderrFile = join(fixturesDir, "_empty.stderr");
  if (!existsSync(stderrFile)) writeFileSync(stderrFile, "truth_check_verdict: trusted\n");

  const r = runRenderer({ stdoutFile, stderrFile, verdict: "trusted" });
  assert.equal(r.rc, 0, r.stderr);
  assert.match(r.summary, /### LangGraph checkpoint verdicts/);
  assert.match(r.summary, /thread:42:checkpoint:1/);
  assert.match(r.summary, /thread:42:checkpoint:2/);

  const golden = caseGoldens("langgraph-checkpoint");
  compareGolden(normalizePaths(r.summary, r.artifactDir), golden.summary);
  compareGolden(normalizePaths(r.outputsRaw, r.artifactDir), golden.outputs);
});

// ---------- non-cert: malformed stdout ----------

test("malformed stdout: no artifact written; outputs empty; operational summary present", () => {
  const stdoutFile = join(fixturesDir, "malformed-stdout.txt");
  const stderrFile = join(fixturesDir, "cli-error-envelope.stderr");

  const r = runRenderer({ stdoutFile, stderrFile, verdict: "unknown", cliExit: "1" });
  assert.equal(r.rc, 0, r.stderr);

  assert.ok(!existsSync(r.artifactPath), "artifact file must not be written");
  for (const key of [
    "state-relation",
    "trust-decision",
    "failing-tool-ids",
    "primary-reason-codes",
    "failing-witness-kinds",
    "recommended-action",
    "automation-safe",
    "certificate-path",
  ]) {
    assert.equal(r.outputs[key], "", `expected empty output for ${key}`);
  }

  assert.match(r.summary, /Operational presentation/);
  assert.match(r.summary, /reason: `malformed`/);
  assert.match(r.summary, /CLI error envelope/);
  assert.match(r.summary, /REGISTRY_NOT_FOUND/);
  assert.match(r.summary, /not uploaded/);
});

// ---------- non-cert: oversized stdout ----------

test("oversized stdout (>256 KiB): treated as non-certificate; outputs empty; no artifact", () => {
  const tmp = mkdtempSync(join(tmpdir(), "as-over-"));
  const stdoutFile = join(tmp, "oversized.txt");
  const stderrFile = join(tmp, "oversized.stderr");
  writeFileSync(stdoutFile, "{".padEnd(300_000, "x"));
  writeFileSync(stderrFile, "truth_check_verdict: unknown\nfailed: oversized\n");

  const r = runRenderer({ stdoutFile, stderrFile, verdict: "unknown" });
  assert.equal(r.rc, 0, r.stderr);
  assert.ok(!existsSync(r.artifactPath));
  assert.equal(r.outputs["state-relation"], "");
  assert.match(r.summary, /reason: `oversized`/);
});

// ---------- verdict / cert disagreement ----------

test("verdict ↔ stateRelation disagreement: warning is emitted; outputs derive from cert", () => {
  const stdoutFile = join(fixturesDir, "trusted.cert.json");
  const stderrFile = join(fixturesDir, "_empty.stderr");
  if (!existsSync(stderrFile)) writeFileSync(stderrFile, "");

  // Lie: claim verdict=not_trusted while certificate says matches_expectations.
  const r = runRenderer({ stdoutFile, stderrFile, verdict: "not_trusted" });
  assert.equal(r.rc, 0, r.stderr);
  assert.match(r.stderr, /::warning::agentskeptic-check: stderr verdict 'not_trusted' disagrees with certificate stateRelation 'matches_expectations'/);
  // Certificate-derived outputs win.
  assert.equal(r.outputs["state-relation"], "matches_expectations");
  assert.equal(r.outputs["trust-decision"], "safe");
});

// ---------- output value clamping ----------

test("renderer clamps oversized output values without crashing", () => {
  // Synthesize a cert with many primary codes (cap is 24 per spine schema, but
  // we still exercise the byte-clamp by stuffing a long actionText into a row).
  const tmp = mkdtempSync(join(tmpdir(), "as-big-"));
  const huge = "X".repeat(8000);
  const cert = JSON.parse(readFileSync(join(fixturesDir, "step-fail.cert.json"), "utf8"));
  cert.evidenceCompleteness.remediationItems[0].actionText = huge;
  const stdoutFile = join(tmp, "big.cert.json");
  const stderrFile = join(tmp, "big.stderr");
  writeFileSync(stdoutFile, JSON.stringify(cert));
  writeFileSync(stderrFile, "truth_check_verdict: not_trusted\n");

  const r = runRenderer({ stdoutFile, stderrFile, verdict: "not_trusted" });
  assert.equal(r.rc, 0, r.stderr);
  // outputs file must remain a valid GITHUB_OUTPUT format (no thrown exceptions)
  assert.ok(r.outputs["state-relation"]);
});
