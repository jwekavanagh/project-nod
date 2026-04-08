import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadSchemaValidator } from "../schemaLoad.js";
import {
  collectPathArgsForPreflight,
  resolveSpawnArgvPaths,
} from "./assurancePathArgs.js";
import { findWorkflowVerifierRepoRoot } from "./findRepoRoot.js";

export type AssuranceRunReportV1 = {
  schemaVersion: 1;
  issuedAt: string;
  scenarios: Array<{ id: string; exitCode: number }>;
};

export type RunAssuranceResult =
  | { ok: true; report: AssuranceRunReportV1; exitCode: 0 | 1 }
  | { ok: false; exitCode: 3; code: string; message: string };

function readManifest(manifestPath: string): unknown {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
}

/**
 * Loads manifest, validates schema, runs each scenario by spawning the built CLI from repo root.
 * Path arguments in each scenario argv are relative to the manifest file's directory.
 */
export function runAssuranceFromManifest(manifestPath: string): RunAssuranceResult {
  const manifestAbs = path.resolve(manifestPath);
  if (!existsSync(manifestAbs)) {
    return {
      ok: false,
      exitCode: 3,
      code: "ASSURANCE_MANIFEST_READ_FAILED",
      message: `Manifest not found: ${manifestPath}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = readManifest(manifestAbs);
  } catch {
    return {
      ok: false,
      exitCode: 3,
      code: "ASSURANCE_MANIFEST_JSON_SYNTAX",
      message: "Manifest JSON parse failed.",
    };
  }

  const validateManifest = loadSchemaValidator("assurance-manifest-v1");
  if (!validateManifest(parsed)) {
    return {
      ok: false,
      exitCode: 3,
      code: "ASSURANCE_MANIFEST_SCHEMA_INVALID",
      message: JSON.stringify(validateManifest.errors ?? []),
    };
  }

  const manifest = parsed as {
    schemaVersion: 1;
    scenarios: Array<{ id: string; kind: "spawn_argv"; argv: string[] }>;
  };

  const manifestDir = path.dirname(manifestAbs);
  const repoRoot =
    findWorkflowVerifierRepoRoot(manifestDir) ?? findWorkflowVerifierRepoRoot(process.cwd());
  if (repoRoot === null) {
    return {
      ok: false,
      exitCode: 3,
      code: "ASSURANCE_REPO_ROOT_NOT_FOUND",
      message: "Could not locate workflow-verifier package root from manifest path.",
    };
  }

  const cliJs = path.join(repoRoot, "dist", "cli.js");
  if (!existsSync(cliJs)) {
    return {
      ok: false,
      exitCode: 3,
      code: "ASSURANCE_CLI_MISSING",
      message: `Built CLI not found: ${cliJs}`,
    };
  }

  const scenarioResults: Array<{ id: string; exitCode: number }> = [];

  for (const sc of manifest.scenarios) {
    const resolvedArgv = resolveSpawnArgvPaths(sc.argv, manifestDir);
    const preflightPaths = collectPathArgsForPreflight(resolvedArgv);
    for (const p of preflightPaths) {
      if (!existsSync(p)) {
        return {
          ok: false,
          exitCode: 3,
          code: "ASSURANCE_MANIFEST_PATH_MISSING",
          message: `Referenced path missing for scenario ${sc.id}: ${p}`,
        };
      }
    }

    const r = spawnSync(
      process.execPath,
      ["--no-warnings", cliJs, ...resolvedArgv],
      { encoding: "utf8", cwd: repoRoot },
    );
    const code = r.status === null ? 3 : r.status;
    scenarioResults.push({ id: sc.id, exitCode: code });
  }

  const issuedAt = new Date().toISOString();
  const report: AssuranceRunReportV1 = {
    schemaVersion: 1,
    issuedAt,
    scenarios: scenarioResults,
  };

  const validateReport = loadSchemaValidator("assurance-run-report-v1");
  if (!validateReport(report)) {
    return {
      ok: false,
      exitCode: 3,
      code: "INTERNAL_ERROR",
      message: JSON.stringify(validateReport.errors ?? []),
    };
  }

  const anyFail = scenarioResults.some((s) => s.exitCode !== 0);
  return {
    ok: true,
    report,
    exitCode: anyFail ? 1 : 0,
  };
}
