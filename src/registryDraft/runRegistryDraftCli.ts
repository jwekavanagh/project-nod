/**
 * CLI `agentskeptic registry-draft` — mirrors POST /api/integrator/registry-draft without HTTP.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { argValue } from "../cliArgv.js";
import {
  getBootstrapPackInputValidator,
  getRegistryDraftRequestValidator,
  getRegistryDraftResponseEnvelopeValidator,
  getToolsRegistryArrayValidator,
} from "./createRegistryDraftAjv.js";
import { generateRegistryDraft, credentialMissingForDraftProvider } from "./engine.js";
import { parseAndNormalizeRegistryDraftRequest } from "./parseAndNormalizeRegistryDraftRequest.js";
import type { DraftProviderId } from "./parseAndNormalizeRegistryDraftRequest.js";

function usage(): string {
  return `Usage:
  agentskeptic registry-draft --provider hosted_openai|local_ollama --request <registry-draft-request.json>
    [--out <directory>]

Reads a registry-draft-request-v1 JSON file plus explicit --provider, runs the Draft Engine, prints the v3 envelope JSON to stdout (one line).
With --out, writes draft tools array as tools.json (array file) and quick-ingest NDJSON as quick-input.ndjson.

Exit codes:
  0 — DraftEngine.success
  3 — credential, provider, or malformed input`;
}

function parseProvider(s: string | undefined): DraftProviderId | undefined {
  if (s === "hosted_openai" || s === "local_ollama") return s;
  return undefined;
}

export async function runRegistryDraftCliAndExit(argv: string[]): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    process.exit(0);
  }

  const providerRaw = argValue(argv, "--provider") ?? "";
  const provider = parseProvider(providerRaw);
  if (!provider) {
    console.error(cliErr("Missing or invalid --provider (hosted_openai | local_ollama)"));
    process.exit(3);
  }

  const requestPath = argValue(argv, "--request");
  if (!requestPath || requestPath.length === 0) {
    console.error(cliErr("Missing required --request <registry-draft-request.json>"));
    process.exit(3);
  }

  const outDir = argValue(argv, "--out");

  let rawEnvelope: string;
  try {
    rawEnvelope = readFileSync(resolve(requestPath), "utf8");
  } catch {
    console.error(cliErr(`Cannot read ${requestPath}`));
    process.exit(3);
  }

  let root: Record<string, unknown>;
  try {
    root = JSON.parse(rawEnvelope) as Record<string, unknown>;
  } catch {
    console.error(cliErr("registry-draft-request JSON parse failed"));
    process.exit(3);
  }

  /** CLI mandates explicit `--provider` (no silent divergence from envelope). */
  root["draftProvider"] = provider;

  const validateReq = getRegistryDraftRequestValidator();
  const validateBoot = getBootstrapPackInputValidator();
  const validateResponse = getRegistryDraftResponseEnvelopeValidator();
  const validateTools = getToolsRegistryArrayValidator();

  const parsed = parseAndNormalizeRegistryDraftRequest(root, validateReq, validateBoot);
  if (!parsed.ok) {
    console.error(cliErr(`INVALID_REQUEST: ${JSON.stringify(parsed.errors ?? [])}`));
    process.exit(3);
  }

  const cre = credentialMissingForDraftProvider(provider, process.env);
  if (cre) {
    console.error(cliErr(cre));
    process.exit(3);
  }

  const out = await generateRegistryDraft({
    parsed,
    validateResponseEnvelope: validateResponse,
    validateToolsRegistryArray: validateTools,
    env: process.env,
  });

  if (!out.ok) {
    console.log(JSON.stringify({ ...out.body, _httpStatus: out.status }));
    process.exit(3);
  }

  console.log(JSON.stringify(out.body));

  if (outDir) {
    const dir = resolve(outDir);
    mkdirSync(dir, { recursive: true });
    const draft = out.body["draft"] as { tools?: unknown };
    writeFileSync(
      `${dir}/tools.json`,
      `${JSON.stringify(draft?.tools ?? [], null, 2)}\n`,
      "utf8",
    );
    const q = out.body["quickIngestInput"] as { body?: string } | undefined;
    writeFileSync(`${dir}/quick-input.ndjson`, q?.body ?? "", "utf8");
  }

  process.exit(0);
}

function cliErr(msg: string): string {
  return JSON.stringify({ code: "CLI_REGISTRY_DRAFT", message: msg });
}
