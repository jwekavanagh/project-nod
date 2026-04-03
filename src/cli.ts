#!/usr/bin/env node
import { readFileSync } from "fs";
import path from "path";
import {
  CLI_OPERATIONAL_CODES,
  cliErrorEnvelope,
  formatOperationalMessage,
} from "./failureCatalog.js";
import {
  buildRunComparisonReport,
  formatRunComparisonReport,
} from "./runComparison.js";
import { verifyWorkflow } from "./pipeline.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { WorkflowResult } from "./types.js";

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function argValues(args: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name) {
      if (i + 1 >= args.length) break;
      out.push(args[i + 1]!);
      i++;
    }
  }
  return out;
}

function usageVerify(): string {
  return `Usage:
  verify-workflow --workflow-id <id> --events <path> --registry <path> --db <sqlitePath>
  verify-workflow --workflow-id <id> --events <path> --registry <path> --postgres-url <url>

Provide exactly one of --db or --postgres-url.

Exit codes:
  0  workflow status complete
  1  workflow status inconsistent
  2  workflow status incomplete
  3  operational failure (see stderr JSON)

  verify-workflow compare --prior <path> [--prior <path> ...] --current <path>
  Compare saved WorkflowResult JSON files (local only; see docs).

  --help, -h  print this message and exit 0`;
}

function usageCompare(): string {
  return `Usage:
  verify-workflow compare --prior <workflowResult.json> [--prior <path> ...] --current <workflowResult.json>

Compares the current run (last file) against the immediate prior run (last --prior).
Recurrence uses all runs in order: each --prior in order, then --current.

Exit codes:
  0  comparison succeeded (stdout: RunComparisonReport JSON; stderr: human summary)
  3  operational failure (stderr: JSON envelope only; stdout empty)

  --help, -h  print this message and exit 0`;
}

function writeCliError(code: string, message: string): void {
  console.error(cliErrorEnvelope(code, message));
}

function runCompareSubcommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageCompare());
    process.exit(0);
  }

  const priors = argValues(args, "--prior");
  const currentPath = argValue(args, "--current");

  if (priors.length < 1 || !currentPath) {
    writeCliError(
      CLI_OPERATIONAL_CODES.COMPARE_USAGE,
      "compare requires at least one --prior and --current.",
    );
    process.exit(3);
  }

  const paths = [...priors, currentPath];
  const validateWf = loadSchemaValidator("workflow-result");
  const results: WorkflowResult[] = [];
  const displayLabels: string[] = [];

  for (const filePath of paths) {
    displayLabels.push(path.basename(filePath));
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf8");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.COMPARE_INPUT_READ_FAILED, formatOperationalMessage(msg));
      process.exit(3);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.COMPARE_INPUT_JSON_SYNTAX, formatOperationalMessage(msg));
      process.exit(3);
    }
    if (!validateWf(parsed)) {
      writeCliError(
        CLI_OPERATIONAL_CODES.COMPARE_INPUT_SCHEMA_INVALID,
        JSON.stringify(validateWf.errors ?? []),
      );
      process.exit(3);
    }
    results.push(parsed as WorkflowResult);
  }

  const wf0 = results[0]!.workflowId;
  for (const r of results) {
    if (r.workflowId !== wf0) {
      writeCliError(
        CLI_OPERATIONAL_CODES.COMPARE_WORKFLOW_ID_MISMATCH,
        "All WorkflowResult inputs must share the same workflowId.",
      );
      process.exit(3);
    }
  }

  let report;
  try {
    report = buildRunComparisonReport(results, displayLabels);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }

  const validateReport = loadSchemaValidator("run-comparison-report");
  if (!validateReport(report)) {
    writeCliError(
      CLI_OPERATIONAL_CODES.COMPARE_RUN_COMPARISON_REPORT_INVALID,
      JSON.stringify(validateReport.errors ?? []),
    );
    process.exit(3);
  }

  process.stderr.write(`${formatRunComparisonReport(report)}\n`);
  console.log(JSON.stringify(report));
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "compare") {
    runCompareSubcommand(args.slice(1));
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageVerify());
    process.exit(0);
  }

  const workflowId = argValue(args, "--workflow-id");
  const eventsPath = argValue(args, "--events");
  const registryPath = argValue(args, "--registry");
  const dbPath = argValue(args, "--db");
  const postgresUrl = argValue(args, "--postgres-url");

  if (!workflowId || !eventsPath || !registryPath) {
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, "Missing --workflow-id, --events, or --registry.");
    process.exit(3);
  }

  const dbCount = (dbPath ? 1 : 0) + (postgresUrl ? 1 : 0);
  if (dbCount !== 1) {
    writeCliError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "Provide exactly one of --db or --postgres-url.",
    );
    process.exit(3);
  }

  let result;
  try {
    result = await verifyWorkflow({
      workflowId,
      eventsPath,
      registryPath,
      database: postgresUrl
        ? { kind: "postgres", connectionString: postgresUrl }
        : { kind: "sqlite", path: dbPath! },
    });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }

  const validateResult = loadSchemaValidator("workflow-result");
  if (!validateResult(result)) {
    writeCliError(
      CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      JSON.stringify(validateResult.errors ?? []),
    );
    process.exit(3);
  }

  console.log(JSON.stringify(result));

  if (result.status === "complete") process.exit(0);
  if (result.status === "inconsistent") process.exit(1);
  process.exit(2);
}

void main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(cliErrorEnvelope(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg)));
  process.exit(3);
});
