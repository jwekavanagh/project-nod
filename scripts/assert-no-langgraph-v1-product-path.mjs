#!/usr/bin/env node
/**
 * Elimination proof: no authoritative v1 LangGraph product path in example driver, CI core, or generated commands.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const watchedFiles = [
  path.join(root, "examples", "langgraph-reference", "run.mjs"),
  path.join(root, "scripts", "lib", "langgraphReferenceVerifyCore.mjs"),
  path.join(root, "docs", "partner-quickstart-commands.md"),
  path.join(root, "src", "verify", "batchVerifyTelemetrySubcommand.ts"),
  path.join(root, "src", "langGraphCheckpointTrustGate.ts"),
  path.join(root, "src", "langGraphCheckpointTrustIneligibleCertificate.ts"),
];

function fail(msg) {
  console.error("assert-no-langgraph-v1-product-path:", msg);
  process.exit(1);
}

const runPath = watchedFiles[0];
const runSrc = readFileSync(runPath, "utf8");
if (runSrc.includes('"schemaVersion": 1') || runSrc.includes("'schemaVersion': 1")) {
  fail("examples/langgraph-reference/run.mjs must not emit schemaVersion 1");
}

const corePath = watchedFiles[1];
const coreSrc = readFileSync(corePath, "utf8");
if (coreSrc.includes("expected exactly one NDJSON line")) {
  fail("langgraphReferenceVerifyCore.mjs must not retain legacy v1 single-line error text");
}
if (!coreSrc.includes("--langgraph-checkpoint-trust")) {
  fail("langgraphReferenceVerifyCore.mjs must contain --langgraph-checkpoint-trust");
}

const partnerCmdPath = watchedFiles[2];
const md = readFileSync(partnerCmdPath, "utf8");
const anchor = "## LangGraph reference";
const idx = md.indexOf(anchor);
if (idx === -1) {
  fail("docs/partner-quickstart-commands.md must contain a ## LangGraph reference heading");
}
const rest = md.slice(idx);
const nextHeading = rest.search(/\n## /);
const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
if (!section.includes("--langgraph-checkpoint-trust")) {
  fail("LangGraph section in docs/partner-quickstart-commands.md must include --langgraph-checkpoint-trust");
}

const batchSrc = readFileSync(watchedFiles[3], "utf8");
if (!batchSrc.includes("validatedLangGraphIneligibleCertificate")) {
  fail("batchVerifyTelemetrySubcommand.ts must wire LangGraph ineligible short-circuit (validatedLangGraphIneligibleCertificate)");
}
if (!batchSrc.includes("--langgraph-checkpoint-trust")) {
  fail("batchVerifyTelemetrySubcommand.ts must reference --langgraph-checkpoint-trust");
}

const gateSrc = readFileSync(watchedFiles[4], "utf8");
if (!gateSrc.includes("runCheckpointTrust")) {
  fail("langGraphCheckpointTrustGate.ts must expose runCheckpointTrust");
}
if (gateSrc.includes("evaluateCertificate") || /\bevaluate\s*\(/.test(gateSrc)) {
  fail("langGraphCheckpointTrustGate.ts must not retain evaluate/evaluateCertificate API");
}

const ineligibleOnly = readFileSync(watchedFiles[5], "utf8");
for (const needle of ["verifyRunStateFromBufferedRunEvents", "verifyRunStateFromEvents", "pipeline", "sqlReadBackend"]) {
  if (ineligibleOnly.includes(needle)) {
    fail(`langGraphCheckpointTrustIneligibleCertificate.ts must not contain "${needle}"`);
  }
}

console.log("assert-no-langgraph-v1-product-path: ok");
