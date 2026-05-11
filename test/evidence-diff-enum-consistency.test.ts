import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemasDir } from "../src/schemaLoad.js";

function collectJsonSchemaEnumArrays(value: unknown, out: unknown[][]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const x of value) collectJsonSchemaEnumArrays(x, out);
    return;
  }
  const o = value as Record<string, unknown>;
  if ("enum" in o && Array.isArray(o.enum)) out.push(o.enum as unknown[]);
  for (const v of Object.values(o)) collectJsonSchemaEnumArrays(v, out);
}

describe("verification-diff-certificate vs evidence-completeness enums", () => {
  it("$refs evidence blockerCategory and witness supportLabel (no divergent inline enums under evidenceProj)", () => {
    const evidencePath = join(schemasDir(), "evidence-completeness-v1.schema.json");
    const diffPath = join(schemasDir(), "verification-diff-certificate-v1.schema.json");

    const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as {
      properties: { blockerCategory: { enum: string[] } };
      $defs: { witnessCoverageV1: { properties: { supportLabel: { enum: string[] } } } };
    };

    const diff = JSON.parse(readFileSync(diffPath, "utf8")) as {
      $defs: {
        evidenceProj: {
          properties: {
            blockerCategory: { $ref?: string };
            supportLabel?: { oneOf?: Array<{ $ref?: string } | { type?: string }> };
          };
        };
      };
    };

    const blockerRef = diff.$defs.evidenceProj.properties.blockerCategory;
    expect(blockerRef).toEqual({
      $ref: "./evidence-completeness-v1.schema.json#/properties/blockerCategory",
    });

    const sl = diff.$defs.evidenceProj.properties.supportLabel?.oneOf;
    expect(sl?.[0]).toEqual({
      $ref: "./evidence-completeness-v1.schema.json#/$defs/witnessCoverageV1/properties/supportLabel",
    });
    expect(sl?.[1]).toEqual({ type: "null" });

    const inlineEnums: unknown[][] = [];
    collectJsonSchemaEnumArrays(diff.$defs.evidenceProj, inlineEnums);
    expect(inlineEnums).toHaveLength(0);

    const blockerFromEvidence = evidence.properties.blockerCategory.enum;
    const supportFromEvidence = evidence.$defs.witnessCoverageV1.properties.supportLabel.enum;
    expect(new Set(blockerFromEvidence).size).toBe(blockerFromEvidence.length);
    expect(new Set(supportFromEvidence).size).toBe(supportFromEvidence.length);
    expect(blockerFromEvidence.length).toBeGreaterThan(3);
    expect(supportFromEvidence.length).toBeGreaterThan(2);
  });
});
