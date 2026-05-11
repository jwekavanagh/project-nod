import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadCoverageBudgetPolicyPhaseA } from "./coverageBudgetPolicy.js";
import { TruthLayerError } from "./truthLayerError.js";

describe("loadCoverageBudgetPolicyPhaseA", () => {
  it("returns inactive when no explicit path and no project file", () => {
    const r = loadCoverageBudgetPolicyPhaseA({
      explicitCoverageBudgetPath: undefined,
      projectPathResolved: undefined,
    });
    expect(r.active).toBe(false);
  });

  it("rejects duplicate workflowId after schema", () => {
    const dir = mkdtempSync(join(tmpdir(), "as-cb-"));
    const p = join(dir, "bud.json");
    writeFileSync(
      p,
      JSON.stringify({
        schemaVersion: 1,
        workflows: [
          { workflowId: "wf_a", minimumFullySatisfiedKinds: ["sql"] },
          { workflowId: "wf_a", minimumFullySatisfiedKinds: ["http_witness"] },
        ],
      }),
    );
    try {
      expect(() =>
        loadCoverageBudgetPolicyPhaseA({
          explicitCoverageBudgetPath: p,
          projectPathResolved: undefined,
        }),
      ).toThrow(TruthLayerError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
