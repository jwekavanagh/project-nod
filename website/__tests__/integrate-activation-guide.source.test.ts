import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("integrate activation guide wiring", () => {
  it("page imports FirstRunActivationGuide and guide uses embedded first-run commands markdown", () => {
    const pageSrc = readFileSync(
      path.join(__dirname, "..", "src", "app", "integrate", "page.tsx"),
      "utf8",
    );
    expect(pageSrc).toContain("FirstRunActivationGuide");
    expect(pageSrc).toContain("embeddedFirstRunIntegrationMd");
    const guideSrc = readFileSync(
      path.join(__dirname, "..", "src", "app", "integrate", "FirstRunActivationGuide.tsx"),
      "utf8",
    );
    expect(guideSrc).toContain("embeddedPartnerQuickstartCommandsMd");
    expect(guideSrc).toContain("integratorDocsEmbedded");
  });
});
