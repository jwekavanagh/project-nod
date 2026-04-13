import { describe, expect, it } from "vitest";
import {
  embeddedFirstRunIntegrationMd,
  embeddedPartnerQuickstartCommandsMd,
} from "@/generated/integratorDocsEmbedded";

/** R6: /integrate content is available without runtime repo docs/ (build-embedded). */
describe("integrate embedded SSOT", () => {
  it("includes full first-run title and no unavailable fallback copy", () => {
    expect(embeddedFirstRunIntegrationMd).toContain("# First-run integration (SSOT)");
    expect(embeddedFirstRunIntegrationMd.toLowerCase()).not.toContain("integration guide unavailable");
  });

  it("includes first-run commands generated banner", () => {
    expect(embeddedPartnerQuickstartCommandsMd).toContain("First run");
    expect(embeddedPartnerQuickstartCommandsMd.toLowerCase()).not.toContain("unavailable");
  });
});
