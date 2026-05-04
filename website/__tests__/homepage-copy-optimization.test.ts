import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import marketing from "@/lib/marketing";
import { productCopy } from "@/content/productCopy";

describe("homepage copy optimization (key strings)", () => {
  it("exports required hero, trust, example, closing, and demo CTA strings", () => {
    expect(marketing.heroOutcome).toBe("Agents can report success while the database is still wrong.");
    expect(marketing.heroMechanism).toBe(
      "AgentSkeptic re-checks your real stores and fails CI before missing writes reach production.",
    );
    expect(productCopy.homePageMissingWriteDemoCta).toBe("Run the missing-write demo");
    expect(productCopy.trustStripPills[1]?.supporting).toContain("Deterministic JSON your CI can fail on");
    expect(productCopy.homeHeroFailureCaptionMid).toBe("The database said otherwise.");
    expect(productCopy.homeClosing.sectionTitle).toBe("Ready to verify your first workflow?");
  });

  it("first-five-minutes teaser copy includes privacy note paragraph", () => {
    const raw = readFileSync(
      path.join(__dirname, "..", "src", "content", "first-five-minutes.json"),
      "utf8",
    );
    const j = JSON.parse(raw) as { telemetryIntroParagraphs: string[] };
    expect(j.telemetryIntroParagraphs[0]).toBe(
      "Optional telemetry helps connect browser demos and CLI verification. It never affects verdicts, never writes to your stores, and can be disabled.",
    );
  });

  it("homepage source includes trace bridge and missing-write CTA wiring", () => {
    const pageSrc = readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8");
    expect(pageSrc).toContain("Agent traces show what the agent attempted.");
    expect(pageSrc).toContain("AgentSkeptic checks whether the promised state actually exists.");
    expect(pageSrc).toContain("home-closing-primary-cta");
  });
});
