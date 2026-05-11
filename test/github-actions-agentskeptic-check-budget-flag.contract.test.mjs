/**
 * Composite action: INPUT_ENFORCE_COVERAGE_BUDGET gates --enforce-coverage-budget (case-sensitive true).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const bashOk = spawnSync("bash", ["--version"], { encoding: "utf8" }).status === 0;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const runAction = join(root, ".github", "actions", "agentskeptic-check", "run-action.sh");

const bashGuard = `
set -euo pipefail
enforce_coverage_budget="\${INPUT_ENFORCE_COVERAGE_BUDGET:-false}"
mode=check
cmd=(echo npx tool)
if [[ "$mode" == "check" && "$enforce_coverage_budget" == "true" ]]; then
  cmd+=(--enforce-coverage-budget)
fi
printf '%s' "\${cmd[*]}"
`;

test("run-action.sh documents enforce coverage budget env and flag", () => {
  const src = readFileSync(runAction, "utf8");
  assert.match(src, /INPUT_ENFORCE_COVERAGE_BUDGET/);
  assert.match(src, /\[\[ "\$mode" == "check" && "\$enforce_coverage_budget" == "true" \]\]/);
  assert.match(src, /--enforce-coverage-budget/);
});

function runGuard(envVal) {
  return spawnSync("bash", ["-lc", bashGuard], {
    encoding: "utf8",
    env: { ...process.env, INPUT_ENFORCE_COVERAGE_BUDGET: envVal },
  });
}

test(
  "bash guard: true appends flag; True and false do not",
  { skip: !bashOk },
  () => {
    const t = runGuard("true");
    assert.equal(t.status, 0, t.stderr);
    assert.match(t.stdout, /--enforce-coverage-budget/);
    const u = runGuard("True");
    assert.equal(u.status, 0, u.stderr);
    assert.equal(u.stdout.includes("--enforce-coverage-budget"), false);
    const f = runGuard("false");
    assert.equal(f.status, 0, f.stderr);
    assert.equal(f.stdout.includes("--enforce-coverage-budget"), false);
  },
);
