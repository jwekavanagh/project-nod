/**
 * Composite action shell: policy, capture, stubbed npx (no real CLI).
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, chmodSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const actionDir = join(root, ".github", "actions", "agentskeptic-check");
const scriptPath = join(actionDir, "run-action.sh");

function resolveBash() {
  const fromPath = spawnSync("bash", ["-c", "exit 0"], { encoding: "utf8" });
  if (fromPath.status === 0) return "bash";
  const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  const git = spawnSync(gitBash, ["-c", "exit 0"], { encoding: "utf8" });
  if (git.status === 0) return gitBash;
  return null;
}

const bashExe = resolveBash();
const hasBash = bashExe !== null;

/** @param {Record<string, string>} env */
function runAction(env, stubDir) {
  const e = { ...process.env, ...env };
  const sep = process.platform === "win32" ? ";" : ":";
  e.PATH = `${stubDir}${sep}${e.PATH || ""}`;
  e.GITHUB_ACTION_PATH = actionDir;
  if (!e.RUNNER_TEMP) {
    e.RUNNER_TEMP = mkdtempSync(join(tmpdir(), "as-ga-"));
  }
  // Ensure run-action.sh's renderer hand-off can locate Node when bash inherits a
  // pruned PATH (e.g. Git Bash on Windows). The composite action's GitHub-Actions
  // runtime always has Node on PATH via actions/setup-node; this is a test-only safety net.
  if (!e.AGENTSKEPTIC_RENDERER_NODE) {
    e.AGENTSKEPTIC_RENDERER_NODE = process.execPath;
  }
  return spawnSync(/** @type {string} */ (bashExe), [scriptPath], { encoding: "utf8", env: e });
}

function makeStubDir() {
  const d = mkdtempSync(join(tmpdir(), "as-npx-"));
  const nxp = join(d, "npx");
  writeFileSync(
    nxp,
    `#!/usr/bin/env bash
if [[ -n "\${AS_STUB_ARGV_OUT:-}" ]]; then
  : >"$AS_STUB_ARGV_OUT"
  for __a in "$@"; do printf '%s\\n' "$__a" >>"$AS_STUB_ARGV_OUT"; done
fi
printf '%s' "\${AS_STUB_STDOUT-}"
printf '%s' "\${AS_STUB_STDERR-}" >&2
exit "\${AS_STUB_EXIT:-0}"
`,
  );
  chmodSync(nxp, 0o755);
  return d;
}

test("action.yml parses as composite with check default", () => {
  const raw = readFileSync(join(actionDir, "action.yml"), "utf8");
  const doc = /** @type {any} */ (parseYaml(raw));
  assert.equal(doc.runs.using, "composite");
  assert.equal(doc.inputs.mode.default, "check");
  assert.equal(doc.inputs["fail-on"].default, "not_trusted_or_unknown");
  assert.equal(doc.inputs.package.default, "agentskeptic@latest");
  assert.equal(doc.inputs.project.default, "");
  assert.equal(doc.inputs.events.default, "");
  assert.equal(doc.inputs.registry.default, "");
});

test("examples workflow + action YAML files parse", () => {
  for (const rel of [
    "examples/github-actions/agentskeptic-check.yml",
    ".github/actions/agentskeptic-check/action.yml",
  ]) {
    const raw = readFileSync(join(root, rel), "utf8");
    parseYaml(raw);
  }
});

test(
  "run-action.sh: invalid mode fails before npx (exit 2)",
  { skip: !hasBash },
  () => {
    const stubDir = mkdtempSync(join(tmpdir(), "as-npx-bad-mode-"));
    const nxp = join(stubDir, "npx");
    writeFileSync(
      nxp,
      `#!/usr/bin/env bash
echo should-not-run >&2
exit 99
`,
    );
    chmodSync(nxp, 0o755);
    const r = runAction(
      {
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_MODE: "bogus",
      },
      stubDir,
    );
    assert.equal(r.status, 2, r.stderr);
    assert.ok(!r.stderr.includes("should-not-run"), r.stderr);
  },
);

test(
  "run-action.sh: invalid fail-on fails before npx (exit 2)",
  { skip: !hasBash },
  () => {
    const stubDir = mkdtempSync(join(tmpdir(), "as-npx-bad-fail"));
    const nxp = join(stubDir, "npx");
    writeFileSync(
      nxp,
      `#!/usr/bin/env bash
exit 99
`,
    );
    chmodSync(nxp, 0o755);
    const r = runAction(
      {
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_FAIL_ON: "oops",
      },
      stubDir,
    );
    assert.equal(r.status, 2, r.stderr);
  },
);

test(
  "run-action.sh: trusted verdict + exit 0 passes with default fail-on",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: '{"ok":true}\n',
        AS_STUB_STDERR: "truth_check_verdict: trusted\nrelease_critical_truth_check_verdict: trusted\nhuman\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
      },
      stubDir,
    );
    assert.equal(r.status, 0, r.stderr);
  },
);

test(
  "run-action.sh: not_trusted + exit 0 fails with default fail-on",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "{}\n",
        AS_STUB_STDERR: "truth_check_verdict: not_trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
      },
      stubDir,
    );
    assert.equal(r.status, 1, r.stderr);
  },
);

test(
  "run-action.sh: unknown + exit 0 fails with default fail-on",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "{}\n",
        AS_STUB_STDERR: "truth_check_verdict: unknown\nrelease_critical_truth_check_verdict: unknown\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
      },
      stubDir,
    );
    assert.equal(r.status, 1, r.stderr);
  },
);

test(
  "run-action.sh: unknown + exit 0 passes when fail-on is not_trusted",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "{}\n",
        AS_STUB_STDERR: "truth_check_verdict: unknown\nrelease_critical_truth_check_verdict: unknown\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_FAIL_ON: "not_trusted",
      },
      stubDir,
    );
    assert.equal(r.status, 0, r.stderr);
  },
);

test(
  "run-action.sh: propagates non-zero CLI exit code",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "",
        AS_STUB_STDERR: "truth_check_verdict: trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "9",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
      },
      stubDir,
    );
    assert.equal(r.status, 9, r.stderr);
  },
);

test(
  "run-action.sh: critical_not_trusted_or_unknown passes when global not_trusted but critical stderr is trusted",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "{}\n",
        AS_STUB_STDERR: "truth_check_verdict: not_trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_FAIL_ON: "critical_not_trusted_or_unknown",
      },
      stubDir,
    );
    assert.equal(r.status, 0, r.stderr);
  },
);

test(
  "run-action.sh: critical_not_trusted_or_unknown fails when critical stderr is not_trusted",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "{}\n",
        AS_STUB_STDERR: "truth_check_verdict: trusted\nrelease_critical_truth_check_verdict: not_trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_FAIL_ON: "critical_not_trusted_or_unknown",
      },
      stubDir,
    );
    assert.equal(r.status, 1, r.stderr);
  },
);

test(
  "run-action.sh: critical_not_trusted_or_unknown fails when release_critical line missing (cli exit 0)",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "{}\n",
        AS_STUB_STDERR: "truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_FAIL_ON: "critical_not_trusted_or_unknown",
      },
      stubDir,
    );
    assert.equal(r.status, 1, r.stderr);
  },
);

test(
  "run-action.sh: critical_not_trusted_or_unknown propagates non-zero CLI exit before crit line",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "",
        AS_STUB_STDERR: "truth_check_verdict: trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "3",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_FAIL_ON: "critical_not_trusted_or_unknown",
      },
      stubDir,
    );
    assert.equal(r.status, 3, r.stderr);
  },
);

test(
  "run-action.sh: fail-on never does not mask non-zero CLI exit",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "",
        AS_STUB_STDERR: "truth_check_verdict: not_trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "7",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_FAIL_ON: "never",
      },
      stubDir,
    );
    assert.equal(r.status, 7, r.stderr);
  },
);

test(
  "run-action.sh: writes baseline GITHUB_OUTPUT keys and a fallback summary when stdout is not a certificate",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const tmp = mkdtempSync(join(tmpdir(), "as-gh-"));
    const outP = join(tmp, "out");
    const sumP = join(tmp, "sum");
    writeFileSync(outP, "", "utf8");
    writeFileSync(sumP, "", "utf8");
    const r = runAction(
      {
        AS_STUB_STDOUT: "cert-line\n",
        AS_STUB_STDERR: "truth_check_verdict: trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        GITHUB_OUTPUT: outP,
        GITHUB_STEP_SUMMARY: sumP,
        RUNNER_TEMP: tmp,
      },
      stubDir,
    );
    assert.equal(r.status, 0, r.stderr);
    const out = readFileSync(outP, "utf8");
    assert.ok(out.includes("verdict=trusted"), out);
    assert.ok(out.includes("exit-code=0"), out);
    assert.ok(out.includes("stdout-path="), out);
    assert.ok(out.includes("stderr-path="), out);
    // Renderer ran but stdout was not parseable as Outcome Certificate v3, so the
    // certificate-derived outputs are present-but-empty (semantics documented in
    // docs/ambient-ci-distribution.md and action.yml output descriptions).
    const outLines = new Set(out.replace(/\r/g, "").split("\n"));
    assert.ok(outLines.has("state-relation="), `expected empty state-relation= in out:\n${out}`);
    assert.ok(outLines.has("certificate-path="), `expected empty certificate-path= in out:\n${out}`);
    const sum = readFileSync(sumP, "utf8");
    assert.ok(sum.includes("## AgentSkeptic truth check"), sum);
    assert.ok(sum.includes("Operational presentation"), sum);
    assert.ok(sum.includes("CLI stderr (last 80 lines)"), sum);
  },
);

test(
  "run-action.sh: certificate stdout populates structured outputs and writes artifact file",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const tmp = mkdtempSync(join(tmpdir(), "as-cert-"));
    const outP = join(tmp, "out");
    const sumP = join(tmp, "sum");
    writeFileSync(outP, "", "utf8");
    writeFileSync(sumP, "", "utf8");
    const cert = JSON.parse(
      readFileSync(
        join(root, "test", "fixtures", "outcome-ci-surface", "trusted.cert.json"),
        "utf8",
      ),
    );
    const r = runAction(
      {
        AS_STUB_STDOUT: JSON.stringify(cert),
        AS_STUB_STDERR: "truth_check_verdict: trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        GITHUB_OUTPUT: outP,
        GITHUB_STEP_SUMMARY: sumP,
        RUNNER_TEMP: tmp,
      },
      stubDir,
    );
    assert.equal(r.status, 0, r.stderr);
    const out = readFileSync(outP, "utf8");
    for (const key of [
      "state-relation=matches_expectations",
      "trust-decision=safe",
      "release-critical-verdict=trusted",
      "primary-reason-codes=VERIFIED",
      "recommended-action=none",
      "automation-safe=true",
    ]) {
      assert.ok(out.includes(key), `expected ${key} in $GITHUB_OUTPUT:\n${out}`);
    }
    const certPathLine = out.split(/\r?\n/).find((l) => l.startsWith("certificate-path="));
    assert.ok(certPathLine, `expected certificate-path key in:\n${out}`);
    const certPath = certPathLine.slice("certificate-path=".length);
    assert.ok(certPath.endsWith("outcome-certificate.json"), certPath);
    assert.ok(existsSync(certPath), `artifact file expected at ${certPath}`);
    const sum = readFileSync(sumP, "utf8");
    assert.ok(sum.includes("### Failure spine"), sum);
    assert.ok(sum.includes("### Outcome Certificate artifact"), sum);
    assert.ok(sum.includes("agentskeptic-outcome-certificate"), sum);
  },
);

test(
  "run-action.sh: renderer non-zero is non-fatal — exit code and ::warning:: + fallback summary preserved",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const tmp = mkdtempSync(join(tmpdir(), "as-rfail-"));
    const outP = join(tmp, "out");
    const sumP = join(tmp, "sum");
    writeFileSync(outP, "", "utf8");
    writeFileSync(sumP, "", "utf8");
    const failNode = join(tmp, "fail-node.sh");
    writeFileSync(
      failNode,
      `#!/usr/bin/env bash\necho "stub renderer node refusing to run" >&2\nexit 7\n`,
    );
    chmodSync(failNode, 0o755);
    const r = runAction(
      {
        AS_STUB_STDOUT: "{}\n",
        AS_STUB_STDERR: "truth_check_verdict: not_trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        GITHUB_OUTPUT: outP,
        GITHUB_STEP_SUMMARY: sumP,
        RUNNER_TEMP: tmp,
        AGENTSKEPTIC_RENDERER_NODE: failNode,
      },
      stubDir,
    );
    // CLI exit 0 + verdict not_trusted under default fail-on => policy exit 1.
    // The failing renderer must NOT change that.
    assert.equal(r.status, 1, r.stderr);
    assert.ok(
      /::warning::agentskeptic-check: presentation renderer failed/.test(r.stderr),
      r.stderr,
    );
    const sum = readFileSync(sumP, "utf8");
    assert.ok(sum.includes("AgentSkeptic truth check (fallback)"), sum);
    assert.ok(sum.includes("verdict: `not_trusted`"), sum);
  },
);

test(
  "run-action.sh: renderer non-zero with trusted verdict still exits 0 (policy intact)",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const tmp = mkdtempSync(join(tmpdir(), "as-rfail2-"));
    const outP = join(tmp, "out");
    const sumP = join(tmp, "sum");
    writeFileSync(outP, "", "utf8");
    writeFileSync(sumP, "", "utf8");
    const failNode = join(tmp, "fail-node.sh");
    writeFileSync(failNode, `#!/usr/bin/env bash\nexit 9\n`);
    chmodSync(failNode, 0o755);
    const r = runAction(
      {
        AS_STUB_STDOUT: "{}\n",
        AS_STUB_STDERR: "truth_check_verdict: trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        GITHUB_OUTPUT: outP,
        GITHUB_STEP_SUMMARY: sumP,
        RUNNER_TEMP: tmp,
        AGENTSKEPTIC_RENDERER_NODE: failNode,
      },
      stubDir,
    );
    assert.equal(r.status, 0, r.stderr);
  },
);

test(
  "run-action.sh: project-only omits --events and passes --project",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const argvFile = join(mkdtempSync(join(tmpdir(), "as-argv-")), "argv.txt");
    const r = runAction(
      {
        AS_STUB_ARGV_OUT: argvFile,
        AS_STUB_STDOUT: '{"ok":true}\n',
        AS_STUB_STDERR: "truth_check_verdict: trusted\nrelease_critical_truth_check_verdict: trusted\n",
        AS_STUB_EXIT: "0",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_PROJECT: ".",
        INPUT_EVENTS: "",
        INPUT_REGISTRY: "",
        INPUT_DB: "demo.db",
      },
      stubDir,
    );
    assert.equal(r.status, 0, r.stderr);
    const lines = readFileSync(argvFile, "utf8").trimEnd().split("\n");
    assert.ok(lines.includes("--project"), lines.join("|"));
    assert.ok(lines.includes("."), lines.join("|"));
    assert.ok(!lines.includes("--events"), lines.join("|"));
    assert.ok(lines.includes("--db"), lines.join("|"));
    assert.ok(lines.includes("demo.db"), lines.join("|"));
  },
);

test(
  "run-action.sh: XOR fails when project set with events",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_PROJECT: ".",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "",
      },
      stubDir,
    );
    assert.equal(r.status, 2, r.stderr + r.stdout);
    assert.ok(`${r.stdout}${r.stderr}`.includes("::error:"), r.stderr + r.stdout);
  },
);

test(
  "run-action.sh: XOR fails when missing project and missing registry",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_PROJECT: "",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "",
      },
      stubDir,
    );
    assert.equal(r.status, 2, r.stderr + r.stdout);
    assert.ok(`${r.stdout}${r.stderr}`.includes("::error:"), r.stderr + r.stdout);
  },
);
