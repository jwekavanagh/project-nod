import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";

describe("langgraph-checkpoint-trust-b-row.v1 embed", () => {
  it("validates v2 envelope and LangGraph runKind + checkpoint verdicts", () => {
    const root = getRepoRoot();
    const p = join(root, "website", "src", "content", "embeddedReports", "langgraph-checkpoint-trust-b-row.v1.json");
    const raw = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    const vEnv = loadSchemaValidator("public-verification-report-v2");
    expect(vEnv(raw)).toBe(true);
    expect(raw.schemaVersion).toBe(2);
    const cert = raw.certificate as {
      runKind: string;
      stateRelation: string;
      checkpointVerdicts?: { verdict: string }[];
    };
    expect(cert.runKind).toBe("contract_sql_langgraph_checkpoint_trust");
    expect(cert.stateRelation).toBe("matches_expectations");
    expect(cert.checkpointVerdicts?.length).toBeGreaterThan(0);
    expect(cert.checkpointVerdicts?.every((v) => v.verdict === "verified")).toBe(true);
    expect(loadSchemaValidator("outcome-certificate-v1")(raw.certificate)).toBe(true);
  });
});
