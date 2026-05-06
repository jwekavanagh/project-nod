/**
 * OpenAPI YAML must surface the contract manifest at info.x-agentskeptic-contract
 * with values that match the committed manifest head.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

test("openapi-commercial-v1.yaml info.x-agentskeptic-contract matches manifest head", () => {
  const manifest = JSON.parse(
    readFileSync(join(root, "schemas", "contract", "v1.json"), "utf8"),
  );
  const head = manifest.history[manifest.history.length - 1];
  const yaml = parseYaml(readFileSync(join(root, "schemas", "openapi-commercial-v1.yaml"), "utf8"));
  const block = yaml?.info?.["x-agentskeptic-contract"];
  assert.ok(block && typeof block === "object", "x-agentskeptic-contract block must exist");
  assert.equal(block.url, manifest.publicUrl);
  assert.equal(String(block.version), head.manifestVersion);
  assert.equal(String(block.manifestSha256), head.manifestSha256);
});

test("GovernanceAuditBundleV2 decisionEvidenceExport references explicit DecisionEvidenceExport schema", () => {
  const yaml = parseYaml(readFileSync(join(root, "schemas", "openapi-commercial-v1.yaml"), "utf8"));
  const v2 = yaml?.components?.schemas?.GovernanceAuditBundleV2;
  const prop = v2?.properties?.decisionEvidenceExport;
  assert.ok(prop && typeof prop === "object");
  assert.equal(prop.$ref, "#/components/schemas/DecisionEvidenceExport");
  const decisionExport = yaml?.components?.schemas?.DecisionEvidenceExport;
  assert.equal(
    decisionExport?.properties?.manifest?.$ref,
    "#/components/schemas/DecisionEvidenceBundleManifestHosted",
  );
  assert.equal(
    decisionExport?.properties?.embedded?.$ref,
    "#/components/schemas/DecisionEvidenceExportEmbedded",
  );
  assert.equal(decisionExport?.additionalProperties, false);
});
