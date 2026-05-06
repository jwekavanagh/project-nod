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

test("GovernanceAuditBundleV3 present in OpenAPI; GovernanceAuditBundleV2 absent", () => {
  const yaml = parseYaml(readFileSync(join(root, "schemas", "openapi-commercial-v1.yaml"), "utf8"));
  const v3 = yaml?.components?.schemas?.GovernanceAuditBundleV3;
  assert.ok(v3 && typeof v3 === "object", "GovernanceAuditBundleV3 schema must exist");
  assert.equal(v3.properties?.schemaVersion?.const, 3);
  assert.ok(
    v3.properties?.evidenceSlices && typeof v3.properties.evidenceSlices === "object",
    "GovernanceAuditBundleV3 must define evidenceSlices",
  );
  assert.equal(yaml?.components?.schemas?.GovernanceAuditBundleV2, undefined);
  assert.equal(yaml?.components?.schemas?.DecisionEvidenceExport, undefined);
});
