import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import ajvFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { loadSchemaValidator } from "../../src/schemaLoad.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

function compileFrozenPreAdditive(): ReturnType<InstanceType<typeof Ajv2020>["compile"]> {
  const applyFormats = ajvFormats as unknown as (ajv: InstanceType<typeof Ajv2020>) => void;
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  applyFormats(ajv);
  const readSchema = (name: string) => JSON.parse(readFileSync(join(root, "schemas", name), "utf8")) as object;
  ajv.addSchema(readSchema("workflow-engine-result.schema.json"));
  ajv.addSchema(readSchema("workflow-truth-report.schema.json"));
  ajv.addSchema(readSchema("evidence-completeness-v1.schema.json"));
  ajv.addSchema(readSchema("failure-spine-v1.schema.json"));
  const frozenPath = join(__dirname, "outcome-certificate-v3.pre-additive.schema.json");
  const frozen = JSON.parse(readFileSync(frozenPath, "utf8")) as object;
  return ajv.compile(frozen);
}

describe("outcome-certificate-v3 additive compatibility", () => {
  it("P1: certificate without correctnessDefinition validates current schema", () => {
    const raw = readFileSync(join(root, "website/src/content/embeddedReports/minimal-share-v2.json"), "utf8");
    const env = JSON.parse(raw) as { certificate: Record<string, unknown> };
    const v = loadSchemaValidator("outcome-certificate-v3");
    expect(v(env.certificate)).toBe(true);
  });

  it("P2 + P3: payload with correctnessDefinition passes new schema and fails frozen pre-additive validator", () => {
    const raw = readFileSync(join(root, "website/src/content/embeddedReports/minimal-share-v2.json"), "utf8");
    const env = JSON.parse(raw) as { certificate: Record<string, unknown> };
    const withCd = {
      ...env.certificate,
      correctnessDefinition: {
        schemaVersion: 1,
        enforcementKind: "run_ingest_integrity",
        mustAlwaysHold: "stub",
        enforceAs: ["stub-a", "stub-b"],
        remediationAlignment: {
          recommendedAction: "manual_review",
          automationSafe: false,
        },
        enforceableProjection: {
          projectionKind: "run_ingest_integrity",
          workflowId: "wf_fixture_share_v2",
          verificationPolicyFragment: "{}",
          primaryFailureCodes: [],
          ingestContractRequirement: "non_empty_tool_observed_steps",
        },
      },
    };
    const vNew = loadSchemaValidator("outcome-certificate-v3");
    expect(vNew(withCd)).toBe(true);

    const validateOld = compileFrozenPreAdditive();
    expect(validateOld(withCd)).toBe(false);
  });

  it("P4: evidence without rerunReadiness validates evidence schema", () => {
    const raw = readFileSync(join(root, "website/src/content/embeddedReports/minimal-share-v2.json"), "utf8");
    const env = JSON.parse(raw) as { certificate: { evidenceCompleteness: unknown } };
    const v = loadSchemaValidator("evidence-completeness-v1");
    expect(v(env.certificate.evidenceCompleteness)).toBe(true);
  });
});
