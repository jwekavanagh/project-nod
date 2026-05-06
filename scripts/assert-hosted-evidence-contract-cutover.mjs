#!/usr/bin/env node
/**
 * Post–hosted-evidence-cutover forbiddance checks (substring scans; cross-platform Node).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const OPENAPI = join(root, "schemas", "openapi-commercial-v1.yaml");
/** C1: forbidden fragments reappear in committed OpenAPI. */
const C1_FORBIDDEN = /DecisionEvidenceExport|GovernanceAuditBundleV2|hosted_not_recorded/;

/** C3: invariant comment must remain in enforcement parser. */
const ENFORCE_STATE = join(root, "website", "src", "lib", "enforcementState.ts");
const C3_REQUIRED = /cert\.schemaVersion !== 2/;

/** C2: forbids leaky route keys/strings in TS/TSX app source. */
const WEBSITE_SRC = join(root, "website", "src");
const C2_FORBIDDEN = /hosted_not_recorded|decisionEvidenceExport/g;

/** @param {string} dir */
function walkTsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsFiles(p, out);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function main() {
  const openapiText = readFileSync(OPENAPI, "utf8");
  if (C1_FORBIDDEN.test(openapiText)) {
    console.error("[hosted-evidence-cutover] C1: forbidden substring in openapi-commercial-v1.yaml");
    process.exit(3);
  }

  for (const f of walkTsFiles(WEBSITE_SRC)) {
    const t = readFileSync(f, "utf8");
    if (C2_FORBIDDEN.test(t)) {
      console.error(`[hosted-evidence-cutover] C2: forbidden substring in ${f}`);
      process.exit(4);
    }
  }

  const enc = readFileSync(ENFORCE_STATE, "utf8");
  if (!C3_REQUIRED.test(enc)) {
    console.error("[hosted-evidence-cutover] C3: missing cert.schemaVersion !== 2 token in enforcementState.ts");
    process.exit(5);
  }

  console.log("hosted-evidence-cutover-assertions-ok");
}

main();
