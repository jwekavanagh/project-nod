#!/usr/bin/env node
/**
 * IntegrateSpine E2E: full shipped bash template (L0), classifier binding, verdict artifact.
 * Normative: docs/first-run-integration.md (Integrate spine).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { classifyBatchVerifyWorkload } from "../dist/commercial/verifyWorkloadClassify.js";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const templatePath = join(root, "scripts", "templates", "integrate-activation-shell.bash");
const verdictPath = join(root, "artifacts", "integrate-spine-validation-verdict.json");
const examplesIntegrateDir = join(root, "examples", "integrate-your-db");
const bootstrapInput = join(examplesIntegrateDir, "bootstrap-input.json");
const requiredSql = join(examplesIntegrateDir, "required-sqlite-state.sql");
const cliPath = join(root, "dist", "cli.js");

const GUARD_SUBSTRING =
  "AgentSkeptic integrate spine: set AGENTSKEPTIC_VERIFY_DB to a readable SQLite file path";

function writeVerdict(status) {
  writeFileSync(verdictPath, `${JSON.stringify({ schemaVersion: 1, status }, null, 0)}\n`, "utf8");
}

function fail(message) {
  console.error(`validate-integrate-spine: ${message}`);
  writeVerdict("not_solved");
  process.exit(1);
}

function seedIntegrateDb(targetPath) {
  const sql = readFileSync(requiredSql, "utf8");
  const db = new DatabaseSync(targetPath);
  db.exec(sql);
  db.close();
}

function resolveBash() {
  const r = spawnSync("bash", ["-c", "echo ok"], { encoding: "utf8" });
  if (r.status === 0) return "bash";
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const r2 = spawnSync(p, ["-c", "echo ok"], { encoding: "utf8" });
    if (r2.status === 0) return p;
  }
  fail("bash is required for validate-integrate-spine (install Git for Windows or add bash to PATH)");
}

const bashPath = resolveBash();

/**
 * 8.3 short path avoids MSYS/Git-Bash splitting `Program Files` argv for `node dist/cli.js …` invocations.
 * Path is passed via env (not interpolated into the cmd line) so CodeQL does not treat it as incompletely escaped.
 */
function windowsShortExePath(winPath) {
  const envName = "AGENTSKEPTIC_VALIDATE_INTEGRATE_SPINE_TARGET";
  const r = spawnSync("cmd.exe", ["/d", "/s", "/c", `for %I in ("%${envName}%") do @echo %~sI`], {
    encoding: "utf8",
    env: { ...process.env, [envName]: winPath },
  });
  if (r.status === 0 && r.stdout) {
    const lines = String(r.stdout)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const last = lines[lines.length - 1];
    if (last && /\.exe$/i.test(last) && !last.includes("*")) return last;
  }
  return winPath;
}

/**
 * Pin a space-free node.exe copy under the ephemeral work dir for Git Bash argv stability on Windows hosts.
 */
function prepareIntegrateSpineNodeShim(workDir) {
  if (process.platform !== "win32") return process.execPath;
  const shim = join(workDir, "integrate-spine-node.exe");
  copyFileSync(process.execPath, shim);
  return windowsShortExePath(shim);
}

/** Validator-only: after clone, L0.5 may be missing from file:// clone until committed; sync from host root. */
function validatorHarnessShellBody(templateUtf8) {
  const inject = `cd agentskeptic || cd workspace
# validate-integrate-spine harness: L0.5 sync when absent (CI: files already committed; local: uncommitted tree)
if [ ! -f examples/integrate-your-db/bootstrap-input.json ] && [ -n "\${INTEGRATE_SPINE_HOST_ROOT:-}" ]; then
  mkdir -p examples/integrate-your-db
  cp "\$INTEGRATE_SPINE_HOST_ROOT/examples/integrate-your-db/bootstrap-input.json" examples/integrate-your-db/
  cp "\$INTEGRATE_SPINE_HOST_ROOT/examples/integrate-your-db/required-sqlite-state.sql" examples/integrate-your-db/
fi
if [ -n "\${INTEGRATE_SPINE_HOST_ROOT:-}" ]; then
  cp "\$INTEGRATE_SPINE_HOST_ROOT/scripts/partner-quickstart-verify.mjs" scripts/partner-quickstart-verify.mjs
fi
if [ -n "\${INTEGRATE_SPINE_HOST_ROOT:-}" ] && [ ! -f schemas/activation-manifest-v1.schema.json ] && [ -f "\$INTEGRATE_SPINE_HOST_ROOT/schemas/activation-manifest-v1.schema.json" ]; then
  mkdir -p schemas
  cp "\$INTEGRATE_SPINE_HOST_ROOT/schemas/activation-manifest-v1.schema.json" schemas/
fi
`;
  const nl = templateUtf8.replace(/\r\n/g, "\n");
  if (!nl.includes("cd agentskeptic\n")) {
    throw new Error("integrate template must contain cd agentskeptic newline");
  }
  return nl.replace("cd agentskeptic\n", inject);
}

/**
 * file:// clone compiles committed HEAD only; `npm start` runs `npm run build` again and would overwrite dist with a tree
 * that may lack branch-local CLI (e.g. activate). Overlay host dist before spine exercises activate/crossing.
 */
function injectHostDistOverlayBeforeFirstRunVerify(scriptBody) {
  const needle = "npm run first-run-verify\n";
  const insert = `# validate-integrate-spine harness: overlay host dist (clone build reflects HEAD; branch may carry uncommitted CLI)
if [ -n "\${INTEGRATE_SPINE_HOST_ROOT:-}" ] && [ -d "\$INTEGRATE_SPINE_HOST_ROOT/dist" ]; then
  rm -rf dist
  cp -R "\$INTEGRATE_SPINE_HOST_ROOT/dist" ./dist
fi
`;
  if (!scriptBody.includes(needle)) {
    throw new Error("integrate spine script must contain npm run first-run-verify newline");
  }
  return scriptBody.replace(needle, insert + needle);
}

function runFullSpine(workDir, extraEnv) {
  const spineNodeExe = prepareIntegrateSpineNodeShim(workDir);
  const raw = readFileSync(templatePath, "utf8");
  const scriptBody = injectHostDistOverlayBeforeFirstRunVerify(validatorHarnessShellBody(raw));
  const scriptPath = join(workDir, "integrate-spine.sh");
  writeFileSync(scriptPath, scriptBody, "utf8");
  const env = {
    ...process.env,
    ...extraEnv,
    INTEGRATE_SPINE_HOST_ROOT: root,
    INTEGRATE_SPINE_NODE: spineNodeExe,
  };
  if (!Object.prototype.hasOwnProperty.call(extraEnv, "AGENTSKEPTIC_VERIFY_DB")) {
    delete env.AGENTSKEPTIC_VERIFY_DB;
  }
  return spawnSync(bashPath, [scriptPath], {
    cwd: workDir,
    env,
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
  });
}

function assertNonBundled(eventsPath, registryPath, dbPath) {
  const wl = classifyBatchVerifyWorkload({
    eventsPath,
    registryPath,
    database: { kind: "sqlite", path: dbPath },
  });
  if (wl !== "non_bundled") {
    fail(`classifyBatchVerifyWorkload expected non_bundled, got ${wl} (classifier contract binding)`);
  }
}

function casePositive() {
  const workDir = mkdtempSync(join(tmpdir(), "integrate-spine-e2e-"));
  let outPack = null;
  try {
    const dbPath = join(workDir, "spine.db");
    seedIntegrateDb(dbPath);
    const gitUrl = pathToFileURL(join(root, ".git")).href;
    const r = runFullSpine(workDir, {
      INTEGRATE_SPINE_GIT_URL: gitUrl,
      AGENTSKEPTIC_VERIFY_DB: dbPath,
    });
    if (r.status !== 0) {
      console.error(r.stdout?.slice(-8000));
      console.error(r.stderr?.slice(-8000));
      fail(`positive E2E: expected exit 0, got ${r.status}`);
    }
    outPack = join(tmpdir(), `integrate-spine-pack-${Date.now()}-${process.pid}`);
    if (existsSync(outPack)) {
      rmSync(outPack, { recursive: true, force: true });
    }
    const b = spawnSync(process.execPath, [cliPath, "activate", "--input", bootstrapInput, "--db", dbPath, "--out", outPack], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    if (b.status !== 0) {
      fail(`positive classifier prelude: bootstrap failed: ${b.stderr}`);
    }
    assertNonBundled(join(outPack, "events.ndjson"), join(outPack, "tools.json"), dbPath);
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    if (outPack) {
      try {
        rmSync(outPack, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

function caseMismatch() {
  const badDb = join(tmpdir(), `integrate-spine-bad-${Date.now()}.db`);
  const db = new DatabaseSync(badDb);
  // Schema matches L0.5 but no row for recordId c_integrate_spine → quick ROW_ABSENT (non-zero bootstrap).
  // Wrong name/status alone does not fail quick for this spine: export uses PK-only required_fields=[].
  db.exec("CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT, status TEXT);");
  db.close();
  const outPack = join(tmpdir(), `integrate-spine-badpack-${Date.now()}-${process.pid}`);
  if (existsSync(outPack)) {
    rmSync(outPack, { recursive: true, force: true });
  }
    const b = spawnSync(process.execPath, [cliPath, "activate", "--input", bootstrapInput, "--db", badDb, "--out", outPack], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  rmSync(outPack, { recursive: true, force: true });
  rmSync(badDb, { force: true });
  if (b.status === 0) {
    fail("mismatch case: expected bootstrap to fail on DB missing contract row, got exit 0");
  }
}

function caseMissingEnv() {
  const workDir = mkdtempSync(join(tmpdir(), "integrate-spine-missing-"));
  const gitUrl = pathToFileURL(join(root, ".git")).href;
  const r = runFullSpine(workDir, { INTEGRATE_SPINE_GIT_URL: gitUrl });
  rmSync(workDir, { recursive: true, force: true });
  if (r.status === 0) {
    fail("missing AGENTSKEPTIC_VERIFY_DB: expected non-zero exit after demo");
  }
  const err = `${r.stderr || ""}${r.stdout || ""}`;
  if (!err.includes(GUARD_SUBSTRING)) {
    fail(`missing-env case: stderr/stdout should include guard message; got tail: ${err.slice(-2000)}`);
  }
}

function main() {
  if (!existsSync(cliPath)) {
    fail("dist/cli.js missing at repo root; run npm run build before validate-integrate-spine");
  }
  const hostDist = join(root, "dist");
  if (!existsSync(hostDist)) {
    fail("dist/ missing at repo root; run npm run build before validate-integrate-spine");
  }
  try {
    casePositive();
    caseMismatch();
    caseMissingEnv();
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  writeVerdict("solved");
  process.exit(0);
}

main();
