import { integrateActivation } from "@/content/productCopy";
import { describe, expect, it } from "vitest";

describe("integrate next-steps surface (PR-O4)", () => {
  it("two next steps: crossing SSOT first, then first-run; no registry-draft peer CTA", () => {
    expect(integrateActivation.nextSteps.length).toBe(2);
    expect(JSON.stringify(integrateActivation.nextSteps).toLowerCase()).not.toContain("registry-draft");
    expect(integrateActivation.nextSteps[0].href).toContain("crossing-normative.md");
    expect(integrateActivation.nextSteps[1].href).toContain("first-run-integration.md");
    expect(integrateActivation.nextSteps[1].href).toMatch(
      /^https:\/\/github\.com\/jwekavanagh\/agentskeptic\/blob\/main\/docs\/first-run-integration\.md(#.+)?$/,
    );
  });
});
