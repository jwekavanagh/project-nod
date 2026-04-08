/**
 * Post-build Quick Verify gate: temp DB, spawn CLI quick, JSON stdout, registry canonical bytes.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";

export const QUICK_VERIFY_SPAWN_TIMEOUT_MS = 120_000;

/**
 * @param {import("node:child_process").SpawnSyncReturnsWithEncodedString<string>} r
 */
export function spawnSyncTimedOut(r) {
  if (r.error?.code === "ETIMEDOUT") return true;
  if (r.signal === "SIGTERM" && (r.status === null || r.status === undefined)) return true;
  return false;
}

/**
 * @param {{
 *   root: string;
 *   cliJs: string;
 *   spawnTimeoutMs: number;
 * }} opts
 */
export async function runQuickVerifyPostbuildGate(opts) {
  const { root, cliJs, spawnTimeoutMs } = opts;
  const seedSql = readFileSync(join(root, "examples", "seed.sql"), "utf8");
  const inputPath = join(root, "test", "fixtures", "quick-verify", "pass-line.ndjson");
  const tmp = mkdtempSync(join(tmpdir(), "qv-gate-"));
  const dbPath = join(tmp, "gate.db");
  const regPath = join(tmp, "reg.json");

  const stderrParts = [];
  let report = null;
  let registryUtf8Match = false;
  let elapsedMs = 0;

  try {
    const db = new DatabaseSync(dbPath);
    db.exec(seedSql);
    db.close();

    const t0 = performance.now();
    const r = spawnSync(
      process.execPath,
      [cliJs, "quick", "--input", inputPath, "--db", dbPath, "--export-registry", regPath],
      { encoding: "utf8", cwd: root, maxBuffer: 10_000_000, timeout: spawnTimeoutMs },
    );
    elapsedMs = performance.now() - t0;

    const spawnTimedOut = spawnSyncTimedOut(r);

    if (spawnTimedOut) {
      stderrParts.push("validate-ttfv: quick verify subprocess timed out");
      return {
        exitCode: 1,
        elapsedMs,
        report: null,
        registryUtf8Match: false,
        spawnTimedOut: true,
        stderrSummary: stderrParts.join("; "),
      };
    }

    if (r.status !== 0) {
      stderrParts.push(`validate-ttfv: quick verify failed status=${r.status}`);
      if (r.stderr) stderrParts.push(r.stderr.slice(0, 2048));
      return {
        exitCode: 1,
        elapsedMs,
        report: null,
        registryUtf8Match: false,
        spawnTimedOut: false,
        stderrSummary: stderrParts.join("; "),
      };
    }

    if (elapsedMs > QUICK_VERIFY_SPAWN_TIMEOUT_MS) {
      stderrParts.push(
        `validate-ttfv: exceeded ${QUICK_VERIFY_SPAWN_TIMEOUT_MS}ms wall clock (${Math.round(elapsedMs)}ms)`,
      );
      return {
        exitCode: 1,
        elapsedMs,
        report: null,
        registryUtf8Match: false,
        spawnTimedOut: false,
        stderrSummary: stderrParts.join("; "),
      };
    }

    const line = r.stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop();
    if (!line) {
      stderrParts.push("validate-ttfv: no JSON stdout line");
      return {
        exitCode: 1,
        elapsedMs,
        report: null,
        registryUtf8Match: false,
        spawnTimedOut: false,
        stderrSummary: stderrParts.join("; "),
      };
    }

    try {
      report = JSON.parse(line);
    } catch {
      stderrParts.push("validate-ttfv: stdout JSON parse failed");
      return {
        exitCode: 1,
        elapsedMs,
        report: null,
        registryUtf8Match: false,
        spawnTimedOut: false,
        stderrSummary: stderrParts.join("; "),
      };
    }

    const canonicalUrl = pathToFileURL(join(root, "dist", "quickVerify", "canonicalJson.js")).href;
    const { canonicalToolsArrayUtf8 } = await import(canonicalUrl);
    const fileUtf8 = readFileSync(regPath, "utf8");
    registryUtf8Match = fileUtf8 === canonicalToolsArrayUtf8(report.exportableRegistry.tools);

    if (!registryUtf8Match) {
      stderrParts.push("validate-ttfv: registry file !== canonicalToolsArrayUtf8(stdout.tools)");
      return {
        exitCode: 1,
        elapsedMs,
        report,
        registryUtf8Match: false,
        spawnTimedOut: false,
        stderrSummary: stderrParts.join("; "),
      };
    }

    return {
      exitCode: 0,
      elapsedMs,
      report,
      registryUtf8Match: true,
      spawnTimedOut: false,
      stderrSummary: "",
    };
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* */
    }
  }
}
