import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSchemaValidator } from "workflow-verifier";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";

describe("langgraph-guide.v1 embed", () => {
  it("validates envelope + workflow result and ROW_ABSENT invariant", () => {
    const root = getRepoRoot();
    const p = join(root, "website", "src", "content", "embeddedReports", "langgraph-guide.v1.json");
    const raw = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    const vEnv = loadSchemaValidator("public-verification-report-v1");
    expect(vEnv(raw)).toBe(true);
    expect(raw.kind).toBe("workflow");
    const wr = raw.workflowResult as {
      status: string;
      steps: { status: string; reasons?: { code: string }[] }[];
    };
    expect(wr.status).toBe("inconsistent");
    expect(wr.steps[0]?.status).toBe("missing");
    expect(wr.steps[0]?.reasons?.[0]?.code).toBe("ROW_ABSENT");
    expect(loadSchemaValidator("workflow-result")(raw.workflowResult)).toBe(true);
  });
});
