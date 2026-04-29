import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  embeddedFirstRunIntegrationMd,
  embeddedPartnerQuickstartCommandsMd,
} from "@/generated/integratorDocsEmbedded";

const repoRoot = path.resolve(__dirname, "..", "..");
const lf = (s: string) => s.replace(/\r\n/g, "\n");

describe("integratorDocsEmbedded parity vs docs SSOT", () => {
  it("embeddedFirstRunIntegrationMd matches docs/first-run-integration.md", () => {
    const disk = readFileSync(path.join(repoRoot, "docs", "first-run-integration.md"), "utf8");
    expect(lf(embeddedFirstRunIntegrationMd)).toBe(lf(disk));
  });

  it("embeddedPartnerQuickstartCommandsMd matches docs/partner-quickstart-commands.md", () => {
    const disk = readFileSync(path.join(repoRoot, "docs", "partner-quickstart-commands.md"), "utf8");
    expect(lf(embeddedPartnerQuickstartCommandsMd)).toBe(lf(disk));
  });
});
