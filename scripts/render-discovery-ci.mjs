#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  renderCiSummaryMarkdownFromPayload,
  renderCiPrBodyFromPayload,
} = require("./discovery-payload.lib.cjs");

function usage() {
  return `Usage:
  node scripts/render-discovery-ci.mjs summary
  node scripts/render-discovery-ci.mjs pr_body --stderr-file PATH --workflow-stdout-file PATH

Environment:
  WFV_REPO_ROOT   Root of installed workflow-verifier package (default: parent of scripts/)
`;
}

function resolveRoot() {
  const e = process.env.WFV_REPO_ROOT;
  if (e && String(e).trim()) return path.resolve(String(e).trim());
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function loadPayload(root) {
  const p = path.join(root, "dist", "discovery-payload-v1.json");
  const raw = readFileSync(p, "utf8");
  const payload = JSON.parse(raw);
  if (payload.schemaVersion !== 1) {
    console.error("render-discovery-ci: discovery-payload-v1.json schemaVersion must be 1");
    process.exit(2);
  }
  return payload;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error(usage());
    process.exit(2);
  }
  const mode = argv[0];
  if (mode !== "summary" && mode !== "pr_body") {
    console.error(usage());
    process.exit(2);
  }

  const root = resolveRoot();
  let payload;
  try {
    payload = loadPayload(root);
  } catch (e) {
    console.error(
      e instanceof Error ? e.message : e,
      "\nrender-discovery-ci: failed to read dist/discovery-payload-v1.json — run build first.",
    );
    process.exit(2);
  }

  if (mode === "summary") {
    if (argv.length !== 1) {
      console.error(usage());
      process.exit(2);
    }
    process.stdout.write(renderCiSummaryMarkdownFromPayload(payload));
    return;
  }

  let stderrPath = "";
  let stdoutPath = "";
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--stderr-file" && argv[i + 1]) {
      stderrPath = argv[++i];
    } else if (argv[i] === "--workflow-stdout-file" && argv[i + 1]) {
      stdoutPath = argv[++i];
    } else {
      console.error(usage());
      process.exit(2);
    }
  }
  if (!stderrPath || !stdoutPath) {
    console.error(usage());
    process.exit(2);
  }

  const stderrText = readFileSync(stderrPath, "utf8");
  const workflowStdoutText = readFileSync(stdoutPath, "utf8");
  process.stdout.write(
    renderCiPrBodyFromPayload(payload, { stderrText, workflowStdoutText }),
  );
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
