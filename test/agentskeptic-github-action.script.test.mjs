/**
 * Composite action shell: policy, capture, stubbed npx (no real CLI).
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, chmodSync } from "node:fs";
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
  return spawnSync(/** @type {string} */ (bashExe), [scriptPath], { encoding: "utf8", env: e });
}

function makeStubDir() {
  const d = mkdtempSync(join(tmpdir(), "as-npx-"));
  const nxp = join(d, "npx");
  writeFileSync(
    nxp,
    `#!/usr/bin/env bash
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
        AS_STUB_STDERR: "truth_check_verdict: trusted\nhuman\n",
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
        AS_STUB_STDERR: "truth_check_verdict: not_trusted\n",
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
        AS_STUB_STDERR: "truth_check_verdict: unknown\n",
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
        AS_STUB_STDERR: "truth_check_verdict: unknown\n",
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
        AS_STUB_STDERR: "truth_check_verdict: trusted\n",
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
  "run-action.sh: fail-on never clears non-zero CLI exit",
  { skip: !hasBash },
  () => {
    const stubDir = makeStubDir();
    const r = runAction(
      {
        AS_STUB_STDOUT: "",
        AS_STUB_STDERR: "truth_check_verdict: not_trusted\n",
        AS_STUB_EXIT: "7",
        INPUT_WORKFLOW_ID: "wf_complete",
        INPUT_EVENTS: "e.ndjson",
        INPUT_REGISTRY: "r.json",
        INPUT_FAIL_ON: "never",
      },
      stubDir,
    );
    assert.equal(r.status, 0, r.stderr);
  },
);

test(
  "run-action.sh: writes GITHUB_OUTPUT and GITHUB_STEP_SUMMARY",
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
        AS_STUB_STDERR: "truth_check_verdict: trusted\n",
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
    const sum = readFileSync(sumP, "utf8");
    assert.ok(sum.includes("## AgentSkeptic truth check"), sum);
    assert.ok(sum.includes("### Human report / stderr"), sum);
    assert.ok(sum.includes("### Outcome Certificate / stdout"), sum);
  },
);
