import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCoverageBudgetPhaseB } from "./coverageBudget.js";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadCert(name: string): OutcomeCertificateV1 {
  const raw = readFileSync(join(root, "test", "fixtures", "outcome-ci-surface", name), "utf8");
  return JSON.parse(raw) as OutcomeCertificateV1;
}

describe("evaluateCoverageBudgetPhaseB", () => {
  const policyPath = "/tmp/policy.json";
  const policy = {
    schemaVersion: 1 as const,
    workflows: [{ workflowId: "wf_complete", minimumFullySatisfiedKinds: ["http_witness", "sql"] }],
  };

  it("passes when required kinds are subset of fullySatisfiedKinds", () => {
    const cert = loadCert("trusted.cert.json");
    const p = {
      ...policy,
      workflows: [{ workflowId: "wf_complete", minimumFullySatisfiedKinds: ["sql"] }],
    };
    const r = evaluateCoverageBudgetPhaseB({ certificate: cert, policy: p, policyPath });
    expect(r.verdict).toBe("pass");
    expect(r.code).toBe("PASS");
    expect(r.detailLine).toContain("code=PASS");
    expect(r.detailLine).toContain(`workflow=${encodeURIComponent("wf_complete")}`);
  });

  it("fails when required kind missing", () => {
    const cert = loadCert("trusted.cert.json");
    const r = evaluateCoverageBudgetPhaseB({ certificate: cert, policy, policyPath });
    expect(r.verdict).toBe("fail");
    expect(r.code).toBe("FAIL_UNDERFULL");
    expect(r.detailLine).toContain("missing=http_witness");
  });

  it("skipped when no workflow row", () => {
    const cert = loadCert("trusted.cert.json");
    const p = {
      schemaVersion: 1 as const,
      workflows: [{ workflowId: "wf_other", minimumFullySatisfiedKinds: ["sql"] }],
    };
    const r = evaluateCoverageBudgetPhaseB({ certificate: cert, policy: p, policyPath });
    expect(r.verdict).toBe("skipped");
    expect(r.code).toBe("SKIP_NO_ENTRY");
  });
});
