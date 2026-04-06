import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FAILURE_ORIGINS } from "./failureOriginTypes.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function enumFromWorkflowTruthSchema(): string[] {
  const raw = readFileSync(path.join(root, "schemas", "workflow-truth-report.schema.json"), "utf8");
  const j = JSON.parse(raw) as {
    $defs?: { failureOrigin?: { enum?: string[] } };
  };
  const e = j.$defs?.failureOrigin?.enum;
  if (!Array.isArray(e)) throw new Error("missing failureOrigin enum in workflow-truth-report.schema.json");
  return e;
}

describe("failureOriginSchemaEnum", () => {
  it("FAILURE_ORIGINS matches workflow-truth-report $defs.failureOrigin.enum (order-independent)", () => {
    const schemaEnum = enumFromWorkflowTruthSchema();
    expect([...FAILURE_ORIGINS].sort()).toEqual([...schemaEnum].sort());
  });
});
