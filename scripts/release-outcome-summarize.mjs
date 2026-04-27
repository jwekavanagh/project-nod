#!/usr/bin/env node
/**
 * Pinned semantic-release log substrings (English) for classification.
 * Emits RELEASE_OUTCOME= (contract-tested) for every invocation.
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";

const NO_RELEVANT_CHANGES = "There are no relevant changes, so no new version is released.";
const PUBLISHED_RELEASE = "Published release ";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--log" && argv[i + 1]) out.logPath = argv[++i];
    else if (argv[i] === "--exit-code" && argv[i + 1]) out.exitCode = Number(argv[++i]);
  }
  return out;
}

function classify(logText, exitCode) {
  if (exitCode !== 0) return "FAILED";
  if (logText.includes(NO_RELEVANT_CHANGES)) return "SKIPPED_NO_RELEASABLE_COMMITS";
  if (logText.includes(PUBLISHED_RELEASE)) return "CREATED";
  return "SKIPPED_ALREADY_AT_VERSION";
}

function main() {
  const { logPath, exitCode } = parseArgs(process.argv);
  if (!logPath || Number.isNaN(exitCode)) {
    console.error("usage: node scripts/release-outcome-summarize.mjs --log <file> --exit-code <n>");
    process.exit(2);
  }

  const logText = readFileSync(logPath, "utf8");
  const outcome = classify(logText, exitCode);

  const lines = ["## Release outcome", "", `RELEASE_OUTCOME=${outcome}`, ""];
  if (exitCode !== 0) {
    const tail = logText.split("\n").slice(-40).join("\n");
    lines.push("### Log excerpt (last 40 lines)", "", "```", tail, "```", "");
  }
  const full = lines.join("\n");
  process.stdout.write(full);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath && existsSync(path.dirname(summaryPath))) {
    appendFileSync(summaryPath, full, "utf8");
  }
}

main();
