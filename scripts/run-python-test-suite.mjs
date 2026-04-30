#!/usr/bin/env node
/**
 * Sole conductor for CI Python parity: subprocess guardrails, pip editable install, pytest.
 * Extras fragment must match PYTHON_PIP_EXTRAS_FRAGMENT / dist `pythonPipExtrasFragment`.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PYTHON_PIP_EXTRAS_FRAGMENT } from "./execution-identity-constants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pythonDir = join(root, "python");

function run(label, file, forwardArgs, cwd) {
  const argv = [file, ...forwardArgs];
  console.error(`[run-python-test-suite] ${label}: ${[process.execPath, ...argv].join(" ")}`);
  const r = spawnSync(process.execPath, argv, { cwd, env: process.env, stdio: "inherit" });
  const code = typeof r.status === "number" ? r.status : 1;
  if (code !== 0) process.exit(code);
}

function runPy(label, forwardArgs, cwd) {
  const py = process.env.PYTHON ?? "python";
  console.error(`[run-python-test-suite] ${label}: ${py} ${forwardArgs.join(" ")}`);
  const r = spawnSync(py, forwardArgs, { cwd, env: process.env, stdio: "inherit" });
  const code = typeof r.status === "number" ? r.status : 1;
  if (code !== 0) process.exit(code);
}

run("check-python-no-subprocess", join(root, "scripts", "check-python-no-subprocess.mjs"), [], root);
run("assert-python-langgraph-primacy", join(root, "scripts", "assert-python-langgraph-primacy.mjs"), [], root);

const pipExtras = PYTHON_PIP_EXTRAS_FRAGMENT;
runPy(
  "pip editable",
  ["-m", "pip", "install", "-q", "-e", `.[${pipExtras}]`],
  pythonDir,
);

const pytestArgs = ["-m", "pytest", "tests/", "-q"];
if (process.env.PYTEST_ARGS?.trim()) {
  pytestArgs.push(...process.env.PYTEST_ARGS.trim().split(/\s+/));
}
runPy("pytest", pytestArgs, pythonDir);

console.error("[run-python-test-suite] ok");
